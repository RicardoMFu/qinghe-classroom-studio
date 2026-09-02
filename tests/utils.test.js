import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendExam, createExamRecord, createStudent, getStudentExamChange, getStudentExamHistory, gradeValue,
  mergeScoreRows, migrateExamState, parseClassSheetRows, parseScoreCsv, splitCsvLine, swapItems
} from '../src/utils.js';

test('CSV 行支持带逗号和转义引号的字段', () => {
  assert.deepEqual(splitCsvLine('"林,知夏",98,"优""秀"'), ['林,知夏', '98', '优"秀']);
});

test('成绩 CSV 支持 BOM 并解析四个必需字段', () => {
  const rows = parseScoreCsv('\uFEFF姓名,语文,数学,英语\n林知夏,98,96,95');
  assert.deepEqual(rows[0], { name: '林知夏', scores: { 语文: 98, 数学: 96, 英语: 95 } });
});

test('成绩 CSV 缺少字段时返回清晰错误', () => {
  assert.throws(() => parseScoreCsv('姓名,语文\n林知夏,98'), /表头需包含/);
});

test('导入成绩会更新已有学生并追加新学生', () => {
  const seed = [{ id: 1, name: '林知夏', scores: {}, total: 0 }];
  const result = mergeScoreRows(seed, [
    { name: '林知夏', scores: { 语文: 90, 数学: 91, 英语: 92 } },
    { name: '陈屿川', scores: { 语文: 80, 数学: 81, 英语: 82 } }
  ]);
  assert.equal(result.students.length, 2);
  assert.equal(result.students[0].total, 273);
  assert.equal(result.added, 1);
});

test('学校 Excel 行只读取15班与必要字段', () => {
  const rows = [
    ['单位', '班级', '姓名', '身份证号', '语文', '数学', '英语', '生物', '政治', '历史', '地理', '总分'],
    ['测试学校', '七年级15班', '学生甲', '敏感字段', '优+', '优', '良好', '优', '合格', '良好', '优', '优'],
    ['测试学校', '七年级14班', '学生乙', '敏感字段', '优', '优', '优', '优', '优', '优', '优', '优']
  ];
  const students = parseClassSheetRows(rows);
  assert.equal(students.length, 1);
  assert.equal(students[0].name, '学生甲');
  assert.equal(students[0].scores.语文, '优+');
  assert.equal('身份证号' in students[0], false);
});

test('等级成绩可稳定折算排序', () => {
  assert.equal(gradeValue('优+'), 5);
  assert.equal(gradeValue('合格'), 2);
  assert.equal(gradeValue('未知'), 0);
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

test('连续导入考试时保留历史而不是覆盖', () => {
  const levels = ['合格', '良好', '优', '优+'];
  const exams = levels.reduce((history, level, index) => appendExam(history, createExamRecord({
    id: `exam-${index + 1}`,
    name: `第${index + 1}次考试`,
    date: `2026-09-0${index + 1}`,
    students: [{ id: 1, name: '学生甲', scores: { 数学: level } }]
  })), []);
  assert.equal(exams.length, 4);
  assert.deepEqual(exams.map((exam) => exam.name), ['第1次考试', '第2次考试', '第3次考试', '第4次考试']);
  assert.equal(exams[0].students[0].scores.数学, '合格');
  assert.equal(exams[2].students[0].scores.数学, '优');
  assert.equal(exams[3].students[0].scores.数学, '优+');
});

test('旧版单次成绩能迁移为一个考试档案', () => {
  const legacyStudents = [{ id: 1, name: '学生甲', scores: { 语文: '优' }, total: '优' }];
  const migrated = migrateExamState(null, legacyStudents);
  assert.equal(migrated.exams.length, 1);
  assert.equal(migrated.activeExamId, migrated.exams[0].id);
  assert.equal(migrated.exams[0].students[0].name, '学生甲');
});

test('个人成绩轨迹按日期排列并计算相邻变化', () => {
  const exams = [
    createExamRecord({ id: 'later', name: '期中', date: '2026-11-01', students: [{ id: 1, name: '学生甲', scores: { 数学: '优' } }] }),
    createExamRecord({ id: 'earlier', name: '月考', date: '2026-10-01', students: [{ id: 1, name: '学生甲', scores: { 数学: '良好' } }] })
  ];
  const history = getStudentExamHistory(exams, '学生甲', '数学');
  assert.deepEqual(history.map((item) => item.examName), ['月考', '期中']);
  assert.deepEqual(history.map((item) => item.change), [null, 1]);
});

test('成绩变化会跳过没有该学生的中间考试', () => {
  const exams = [
    createExamRecord({ id: 'first', name: '第一次', date: '2026-09-01', students: [{ id: 1, name: '学生甲', scores: { 数学: '良好' } }] }),
    createExamRecord({ id: 'other', name: '其他考试', date: '2026-09-02', students: [{ id: 2, name: '学生乙', scores: { 数学: '优' } }] }),
    createExamRecord({ id: 'current', name: '第二次', date: '2026-09-03', students: [{ id: 1, name: '学生甲', scores: { 数学: '优' } }] })
  ];
  assert.equal(getStudentExamChange(exams, 'current', '学生甲', '数学'), 1);
});
