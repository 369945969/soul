#!/usr/bin/env node

/**
 * DuckDB 适配器完整测试
 */

import duckdb from 'duckdb';

async function test() {
  console.log('\n=== DuckDB 适配器完整测试 ===\n');
  
  // 创建数据库
  const db = new duckdb.Database(':memory:');
  
  // 创建表
  await new Promise((resolve, reject) => {
    db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name VARCHAR, value DOUBLE)', (err) => {
      if (err) reject(err);
      else resolve(null);
    });
  });
  console.log('✅ 表创建成功');
  
  // 插入数据（使用参数绑定）
  await new Promise((resolve, reject) => {
    db.run('INSERT INTO test VALUES (?::INTEGER, ?::VARCHAR, ?::DOUBLE)', 1, 'Alice', 3.14, (err) => {
      if (err) reject(err);
      else resolve(null);
    });
  });
  console.log('✅ 数据插入成功 (1)');
  
  await new Promise((resolve, reject) => {
    db.run('INSERT INTO test VALUES (?::INTEGER, ?::VARCHAR, ?::DOUBLE)', 2, 'Bob', 2.71, (err) => {
      if (err) reject(err);
      else resolve(null);
    });
  });
  console.log('✅ 数据插入成功 (2)');
  
  // 查询数据
  const rows = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM test', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  console.log('✅ 查询成功');
  console.log('数据:', JSON.stringify(rows, null, 2));
  
  // 直接查询单行（使用 all 并取第一条）
  const rows2 = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM test WHERE id = 1', (err, rows) => {
      if (err) reject(err);
      else resolve(rows[0]);
    });
  });
  console.log('✅ 直接查询单行成功');
  console.log('单行数据:', JSON.stringify(rows2, null, 2));
  
  db.close();
  
  console.log('\n✅ DuckDB 适配器完整测试完成\n');
}

test().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
