#!/usr/bin/env node

/**
 * DuckDB 测试脚本
 */

import { DuckDBInstance } from '@duckdb/node-api';

async function test() {
  console.log('\n=== DuckDB 测试 ===\n');
  
  // 创建数据库
  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();
  
  // 创建表
  await conn.run(`
    CREATE TABLE test (
      id INTEGER PRIMARY KEY,
      name VARCHAR,
      value DOUBLE
    )
  `);
  console.log('✅ 表创建成功');
  
  // 插入数据
  await conn.run(`INSERT INTO test VALUES (1, 'Alice', 3.14)`);
  await conn.run(`INSERT INTO test VALUES (2, 'Bob', 2.71)`);
  console.log('✅ 数据插入成功');
  
  // 查询数据
  const result = await conn.run(`SELECT * FROM test`);
  console.log('✅ 查询成功');
  console.log('行数:', result.rowCount);
  
  // 获取数据
  for (let i = 0; i < result.chunkCount; i++) {
    const chunk = result.getChunk(i);
    console.log('Chunk', i, ':', chunk);
  }
  
  // 关闭
  await conn.close();
  instance.closeSync();
  
  console.log('\n✅ DuckDB 测试完成\n');
}

test().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
