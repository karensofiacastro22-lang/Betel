// Punto de entrada en Vercel: la API Express se ejecuta como función serverless.
// Atiende /api/*, /img/* y /uploads/* (ver vercel.json). La interfaz React (dist/) la sirve Vercel directamente.
module.exports = require('../src/server');
