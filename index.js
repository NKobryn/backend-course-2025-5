const http = require('node:http'); // Використовуємо вбудований модуль [cite: 3, 5]
const fs = require('fs').promises; // Для асинхронної роботи з файлами [cite: 47]
const path = require('path');
const { program } = require('commander'); // Для аргументів командного рядка [cite: 31, 37]
const superagent = require('superagent'); // Для запитів на http.cat [cite: 63]

// Налаштування Commander.js [cite: 37, 38, 39]
program
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts(); // Якщо опції не передано, програма викине помилку [cite: 41]

const CACHE_DIR = path.resolve(options.cache);

// Функція для створення директорії, якщо її не існує [cite: 40]
async function ensureCacheDir() {
    try {
        await fs.access(CACHE_DIR);
    } catch (err) {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    }
}

// Запуск веб-сервера [cite: 42]
const server = http.createServer(async (req, res) => {
    // Отримуємо код з URL (наприклад, /200 -> 200) [cite: 48]
    const statusCode = req.url.substring(1);
    const filePath = path.join(CACHE_DIR, `${statusCode}.jpg`);

    if (req.method === 'GET') {
        try {
            // Спробуємо прочитати картинку з кешу [cite: 50]
            const image = await fs.readFile(filePath);
            res.writeHead(200, { 'Content-Type': 'image/jpeg' }); // [cite: 55, 56]
            res.end(image);
        } catch (err) {
            // Якщо в кеші немає, йдемо на http.cat [cite: 61, 64]
            try {
                const response = await superagent.get(`https://http.cat/${statusCode}`);
                const image = response.body;

                // Зберігаємо в кеш [cite: 66]
                await fs.writeFile(filePath, image);

                res.writeHead(200, { 'Content-Type': 'image/jpeg' }); // [cite: 55, 56]
                res.end(image);
            } catch (superagentErr) {
                // Якщо помилка на http.cat (наприклад, 404) [cite: 65]
                res.writeHead(404);
                res.end('Not Found');
            }
        }
    } else if (req.method === 'PUT') {
        // Записуємо картинку з тіла запиту у кеш [cite: 51]
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
            const body = Buffer.concat(chunks);
            await fs.writeFile(filePath, body);
            res.writeHead(201); // [cite: 55]
            res.end('Created');
        });
    } else if (req.method === 'DELETE') {
        // Видаляємо картинку з кешу [cite: 52]
        try {
            await fs.unlink(filePath);
            res.writeHead(200); // [cite: 55]
            res.end('Deleted');
        } catch (err) {
            res.writeHead(404); // Якщо не знайдено [cite: 53]
            res.end('Not Found');
        }
    } else {
        // Якщо метод не дозволено [cite: 52]
        res.writeHead(405);
        res.end('Method Not Allowed');
    }
});

// Запускаємо сервер після перевірки директорії
ensureCacheDir().then(() => {
    server.listen(options.port, options.host, () => {
        console.log(`Сервер запущено на http://${options.host}:${options.port}`);
    });
});