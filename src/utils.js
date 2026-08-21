export function splitCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

export function parseScoreCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('文件中没有可导入的学生记录');
  const headers = splitCsvLine(lines[0]);
  const aliases = {
    name: ['姓名', '学生姓名', 'name'],
    chinese: ['语文', '语文成绩', 'chinese'],
    math: ['数学', '数学成绩', 'math'],
    english: ['英语', '英语成绩', 'english']
  };
  const indexes = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, headers.findIndex((header) => names.includes(header.toLowerCase()))]));
  if (Object.values(indexes).some((index) => index < 0)) throw new Error('表头需包含：姓名、语文、数学、英语');
  return lines.slice(1).map((line, rowIndex) => {
    const cells = splitCsvLine(line);
    const scores = [cells[indexes.chinese], cells[indexes.math], cells[indexes.english]].map(Number);
    if (!cells[indexes.name] || scores.some((score) => !Number.isFinite(score) || score < 0 || score > 150)) {
      throw new Error(`第 ${rowIndex + 2} 行姓名或成绩格式不正确`);
    }
    return { name: cells[indexes.name], chinese: scores[0], math: scores[1], english: scores[2] };
  });
}

export function mergeScoreRows(students, rows) {
  let nextId = Math.max(0, ...students.map((student) => student.id)) + 1;
  const byName = new Map(students.map((student) => [student.name, student]));
  const importedNames = new Set(rows.map((row) => row.name));
  const merged = students.map((student) => {
    const row = rows.find((item) => item.name === student.name);
    if (!row) return student;
    const scores = { 语文: row.chinese, 数学: row.math, 英语: row.english };
    return { ...student, scores, total: row.chinese + row.math + row.english };
  });
  rows.forEach((row) => {
    if (byName.has(row.name)) return;
    const scores = { 语文: row.chinese, 数学: row.math, 英语: row.english };
    merged.push({ id: nextId, name: row.name, gender: '未设置', group: 1, scores, total: row.chinese + row.math + row.english, attendance: '到校' });
    nextId += 1;
  });
  return { students: merged, imported: importedNames.size, added: [...importedNames].filter((name) => !byName.has(name)).length };
}

export function swapItems(items, first, second) {
  if (first < 0 || second < 0 || first >= items.length || second >= items.length) return items;
  const next = [...items];
  [next[first], next[second]] = [next[second], next[first]];
  return next;
}

export function createStudent(values, students) {
  const name = values.name.trim();
  if (!name) throw new Error('请输入学生姓名');
  if (students.some((student) => student.name === name)) throw new Error('学生姓名已存在');
  const id = Math.max(0, ...students.map((student) => student.id)) + 1;
  const scores = { 语文: 0, 数学: 0, 英语: 0 };
  return { id, name, gender: values.gender || '未设置', group: Number(values.group) || 1, scores, total: 0, attendance: '到校' };
}
