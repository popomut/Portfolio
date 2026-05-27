import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as fs from 'fs';
import * as path from 'path';

export const GET: RequestHandler = async () => {
	try {
		const dataPath = path.join(process.cwd(), 'data', 'asset-allocation.json');
		let data = fs.readFileSync(dataPath, 'utf-8');
		// Remove BOM if present
		if (data.charCodeAt(0) === 0xfeff) {
			data = data.slice(1);
		}
		return json(JSON.parse(data));
	} catch (error) {
		console.error('API Error:', error);
		return json({ error: 'Failed to read data', details: String(error) }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = await request.json();
		const dataPath = path.join(process.cwd(), 'data', 'asset-allocation.json');
		fs.writeFileSync(dataPath, JSON.stringify(payload, null, 2), 'utf-8');

		let data = fs.readFileSync(dataPath, 'utf-8');
		// Remove BOM if present
		if (data.charCodeAt(0) === 0xfeff) {
			data = data.slice(1);
		}
		return json(JSON.parse(data));
	} catch (error) {
		console.error('API Error:', error);
		return json({ error: 'Failed to save data', details: String(error) }, { status: 500 });
	}
};
