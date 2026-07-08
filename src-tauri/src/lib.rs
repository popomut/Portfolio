use std::sync::Mutex;

#[cfg(not(debug_assertions))]
use std::process::{Child, Command, Stdio};

// Fixed port for the Node sidecar. Chosen high/random to avoid collisions.
#[cfg(not(debug_assertions))]
const SIDECAR_PORT: u16 = 47821;

struct SidecarState {
	#[cfg(not(debug_assertions))]
	child: Mutex<Option<Child>>,
	#[cfg(debug_assertions)]
	_placeholder: Mutex<()>,
}

#[cfg(not(debug_assertions))]
fn strip_verbatim(p: std::path::PathBuf) -> std::path::PathBuf {
	// Tauri's resource_dir returns paths prefixed with \\?\ on Windows.
	// Some tools (notably Node.js) mishandle this prefix, so strip it.
	let s = p.to_string_lossy();
	if let Some(rest) = s.strip_prefix(r"\\?\") {
		std::path::PathBuf::from(rest)
	} else {
		p
	}
}

#[cfg(not(debug_assertions))]
fn wait_for_server(port: u16, attempts: u32) -> bool {
	use std::net::TcpStream;
	use std::time::Duration;
	for _ in 0..attempts {
		if TcpStream::connect_timeout(
			&format!("127.0.0.1:{port}").parse().unwrap(),
			Duration::from_millis(200),
		)
		.is_ok()
		{
			return true;
		}
		std::thread::sleep(Duration::from_millis(200));
	}
	false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	let state = SidecarState {
		#[cfg(not(debug_assertions))]
		child: Mutex::new(None),
		#[cfg(debug_assertions)]
		_placeholder: Mutex::new(()),
	};

	tauri::Builder::default()
		.manage(state)
		.setup(|app| {
			if cfg!(debug_assertions) {
				app.handle().plugin(
					tauri_plugin_log::Builder::default()
						.level(log::LevelFilter::Info)
						.build(),
				)?;
			}

			#[cfg(not(debug_assertions))]
			{
				use tauri::Manager;
				let resource_dir = strip_verbatim(app.path().resource_dir()?);
				let node_exe = resource_dir.join("binaries").join("node.exe");
				let sidecar_dir = resource_dir.join("sidecar");
				let server_js = sidecar_dir.join("build").join("index.js");

				// Portable DB: place local.db next to the app executable.
				let exe_dir = std::env::current_exe()?
					.parent()
					.expect("exe has no parent dir")
					.to_path_buf();
				let db_path = exe_dir.join("local.db");
				let log_path = exe_dir.join("sidecar.log");

				let mut startup_log = format!(
					"[startup] resource_dir = {}\n[startup] exe_dir = {}\n[startup] db_path = {}\n[startup] node_exe exists: {}\n[startup] server_js exists: {}\n[startup] template.db exists: {}\n",
					resource_dir.display(),
					exe_dir.display(),
					db_path.display(),
					node_exe.exists(),
					server_js.exists(),
					sidecar_dir.join("template.db").exists()
				);

				// Seed from bundled template on first launch.
				if !db_path.exists() {
					let template = sidecar_dir.join("template.db");
					if template.exists() {
						match std::fs::copy(&template, &db_path) {
							Ok(_) => startup_log.push_str("[startup] seeded local.db from template\n"),
							Err(e) => startup_log.push_str(&format!("[startup] SEED FAILED: {e}\n")),
						}
					} else {
						startup_log.push_str("[startup] no template.db to seed from\n");
					}
				} else {
					startup_log.push_str("[startup] local.db already exists, skipping seed\n");
				}

				let db_url = format!("file:{}", db_path.display());
				startup_log.push_str(&format!("[startup] DATABASE_URL = {db_url}\n"));

				let _ = std::fs::write(&log_path, &startup_log);

				let log_file = std::fs::OpenOptions::new()
					.create(true)
					.append(true)
					.open(&log_path)
					.expect("failed to open sidecar log");
				let log_file_stderr = log_file.try_clone().expect("failed to clone log file");

				let spawn_result = Command::new(&node_exe)
					.arg(&server_js)
					.env("PORT", SIDECAR_PORT.to_string())
					.env("HOST", "127.0.0.1")
					.env("DATABASE_URL", &db_url)
					.current_dir(&sidecar_dir)
					.stdout(Stdio::from(log_file))
					.stderr(Stdio::from(log_file_stderr))
					.spawn();

				let child = match spawn_result {
					Ok(c) => c,
					Err(e) => {
						let _ = std::fs::write(
							&log_path,
							format!("{startup_log}[startup] SPAWN FAILED: {e}\n"),
						);
						panic!("failed to start Node sidecar: {e}");
					}
				};

				let state: tauri::State<SidecarState> = app.state();
				*state.child.lock().unwrap() = Some(child);

				if !wait_for_server(SIDECAR_PORT, 100) {
					let extra = format!(
						"[startup] TIMEOUT waiting for sidecar on port {SIDECAR_PORT}\n"
					);
					let _ = std::fs::OpenOptions::new()
						.append(true)
						.open(&log_path)
						.and_then(|mut f| {
							use std::io::Write;
							f.write_all(extra.as_bytes())
						});
					panic!("Node sidecar did not become ready on port {SIDECAR_PORT}");
				}

				let window = app.get_webview_window("main").expect("main window missing");
				let url: tauri::Url = format!("http://127.0.0.1:{SIDECAR_PORT}").parse()?;
				window.navigate(url)?;
			}

			Ok(())
		})
		.on_window_event(|window, event| {
			if let tauri::WindowEvent::Destroyed = event {
				#[cfg(not(debug_assertions))]
				{
					use tauri::Manager;
					let state: tauri::State<SidecarState> = window.state();
					let mut guard = state.child.lock().unwrap();
					if let Some(mut child) = guard.take() {
						let _ = child.kill();
					}
				}
				let _ = window;
			}
		})
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
