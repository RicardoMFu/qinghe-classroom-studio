import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudent, mergeScoreRows, parseScoreCsv, splitCsvLine, swapItems } from '../src/utils.js';

test('CSV 行支持带逗号和转义引号的字段', () => {
  assert.deepEqual(splitCsvLine('"林,知夏",98,"优""秀"'), ['林,知夏', '98', '优"秀']);
});

test('成绩 CSV 支持 BOM 并解析四个必需字段', () => {
  const rows = parseScoreCsv('\uFEFF姓名,语文,数学,英语\n林知夏,98,96,95');
  assert.deepEqual(rows[0], { name: '林知夏', chinese: 98, math: 96, english: 95 });
});

test('成绩 CSV 缺少字段时返回清晰错误', () => {
  assert.throws(() => parseScoreCsv('姓名,语文\n林知夏,98'), /表头需包含/);
});

test('导入成绩会更新已有学生并追加新学生', () => {
  const seed = [{ id: 1, name: '林知夏', scores: {}, total: 0 }];
  const result = mergeScoreRows(seed, [
    { name: '林知夏', chinese: 90, math: 91, english: 92 },
    { name: '陈屿川', chinese: 80, math: 81, english: 82 }
  ]);
  assert.equal(result.students.length, 2);
  assert.equal(result.students[0].total, 273);
  assert.equal(result.added, 1);
});

test('座次交换不修改原数组', () => {
  const source = ['甲', '乙', '丙'];
  assert.deepEqual(swapItems(source, 0, 2), ['丙', '乙', '甲']);
  assert.deepEqual(source, ['甲', '乙', '丙']);
});

test('新增学生拒绝空姓名和重复姓名', () => {
  const students = [{ id: 1, name: '林知夏' }];
  assert.throws(() => createStudent({ name: ' ' }, students), /请输入/);
  assert.throws(() => createStudent({ name: '林知夏' }, students), /已存在/);
  assert.equal(createStudent({ name: '陈屿川', group: 2 }, students).id, 2);
});
