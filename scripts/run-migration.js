// Script para correr la migración inicial contra la base de datos de Railway.
// Uso (desde la consola del servicio en Railway): node scripts/run-migration.js
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const sqlPath = path.join(__dirname, '..', 'infra', 'db', 'migrations', '001_initial_schema.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

const client = new Client({
  connectionString: process.env.DATABASE_URL,
})

;(async () => {
  try {
    await client.connect()
    console.log('Conectado. Ejecutando migración...')
    await client.query(sql)
    console.log('✅ Migración completada con éxito.')
  } catch (err) {
    console.error('❌ ERROR:', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
})()
