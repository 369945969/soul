#!/usr/bin/env node

/**
 * DuckDB WASM 测试脚本
 */

import duckdb from 'duckdb';

async function test() {
  console.log('\n=== DuckDB WASM 测试 ===\n');
  
  // 创建数据库
  const db = new duckdb.Database(':memory:');
  
  // 创建表
  await new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE test (
        id INTEGER PRIMARY KEY,
        name VARCHAR,
        value DOUBLE
      )
    `, (err) => {
      if (err) reject(err);
      else resolve(null);
    });
  });
  console.log('✅ 表创建成功');
  
  // 插入数据
  await new Promise((resolve, reject) => {
    db.run(`INSERT INTO test VALUES (1, 'Alice', 3.14)`, (err) => {
      if (err) reject(err);
      else resolve(null);
    });
  });
  await new Promise((resolve, reject) => {
    db.run(`INSERT INTO test VALUES (2, 'Bob', 2.71)`, (err) => {
      if (err) reject(err);
      else resolve(null);
    });
  });
  console.log('✅ 数据插入成功');
  
  // 查询数据
  const rows = await new Promise((resolve, reject) => {
    db.all(`SELECT * FROM test`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  console.log('✅ 查询成功');
  console.log('数据:', rows);
  
  // 关闭
  db.close();
  
  console.log('\n✅ DuckDB WASM 测试完成\n');
}

test().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
