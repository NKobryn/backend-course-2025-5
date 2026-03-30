const http = require('node:http'); 
const fs = require('fs').promises; 
const path = require('path');
const { program } = require('commander'); 
const superagent = require('superagent'); 

program
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts();

const CACHE_DIR = path.resolve(options.cache);

async function ensureCacheDir() {
    try {
        await fs.access(CACHE_DIR);
    } catch (err) {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    }
}

const server = http.createServer(async (req, res) => {
    const statusCode = req.url.substring(1);
    const filePath = path.join(CACHE_DIR, `${statusCode}.jpg`);

    if (req.method === 'GET') {
        try {
            const image = await fs.readFile(filePath);
            res.writeHead(200, { 'Content-Type': 'image/jpeg' }); 
            res.end(image);
        } catch (err) {
            try {
                const response = await superagent.get(`https://http.cat/${statusCode}`);
                const image = response.body;

                await fs.writeFile(filePath, image);

                res.writeHead(200, { 'Content-Type': 'image/jpeg' }); 
                res.end(image);
            } catch (superagentErr) {
                res.writeHead(404);
                res.end('Not Found');
            }
        }
    } else if (req.method === 'PUT') {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
            const body = Buffer.concat(chunks);
            await fs.writeFile(filePath, body);
            res.writeHead(201);
            res.end('Created');
        });
    } else if (req.method === 'DELETE') {
        try {
            await fs.unlink(filePath);
            res.writeHead(200); 
            res.end('Deleted');
        } catch (err) {
            res.writeHead(404); 
            res.end('Not Found');
        }
    } else {
        res.writeHead(405);
        res.end('Method Not Allowed');
    }
});

ensureCacheDir().then(() => {
    server.listen(options.port, options.host, () => {
        console.log(`Сервер запущено на http://${options.host}:${options.port}`);
    });
});