const express = require('express');
const path = require('path');

const router = express.Router();

// Явные маршруты для важных файлов TON Connect
router.get('/tonconnect-manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(path.join(__dirname, '../../public', 'tonconnect-manifest.json'));
});

router.get('/icon.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(path.join(__dirname, '../../public', 'icon.svg'));
});

router.get('/terms.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public', 'terms.html'));
});

router.get('/privacy.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public', 'privacy.html'));
});

// Favicon
router.get('/favicon.ico', (req, res) => {
    res.setHeader('Content-Type', 'image/x-icon');
    res.sendFile(path.join(__dirname, '../../public', 'favicon.ico'));
});

// Главная страница
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public', 'index.html'));
});

// Админ панель
router.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public', 'admin.html'));
});

// Health check endpoint для предотвращения засыпания на бесплатном тарифе
router.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

module.exports = router;
