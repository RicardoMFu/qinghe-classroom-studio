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

export const gradeSubjects = ['语文', '数学', '英语', '生物', '政治', '历史', '地理'];
export const gradeOrder = ['待提高', '合格', '良好', '优', '优+'];

export function gradeValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const index = gradeOrder.indexOf(String(value ?? '').trim());
  return index >= 0 ? index + 1 : 0;
}

export function isGradeScale(students) {
  return students.some((student) => gradeSubjects.some((subject) => typeof student.scores?.[subject] === 'string'));
}

export function parseClassSheetRows(rows, expectedClass = '七年级15班') {
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('工作表中没有可导入的学生记录');
  const headers = rows[0].map((cell) => String(cell ?? '').trim());
  const indexOf = (name) => headers.indexOf(name);
  const nameIndex = indexOf('姓名');
  const classIndex = indexOf('班级');
  if (nameIndex < 0 || classIndex < 0) throw new Error('工作表需包含“姓名”和“班级”列');
  const availableSubjects = gradeSubjects.filter((subject) => indexOf(subject) >= 0);
  if (availableSubjects.length < 3) throw new Error('工作表至少需要包含语文、数学、英语等三个成绩列');
  const totalIndex = indexOf('总分');
  const seen = new Set();
  const students = [];
  rows.slice(1).forEach((row, rowIndex) => {
    const className = String(row[classIndex] ?? '').trim();
    if (className !== expectedClass) return;
    const name = String(row[nameIndex] ?? '').trim();
    if (!name) throw new Error(`第 ${rowIndex + 2} 行缺少学生姓名`);
    if (seen.has(name)) throw new Error(`学生姓名重复：${name}`);
    const scores = Object.fromEntries(availableSubjects.map((subject) => {
      const raw = row[indexOf(subject)];
      const value = typeof raw === 'number' ? raw : String(raw ?? '').trim();
      if (!gradeValue(value)) throw new Error(`第 ${rowIndex + 2} 行“${subject}”成绩格式不正确`);
      return [subject, value];
    }));
    const total = totalIndex >= 0 && row[totalIndex] !== null && row[totalIndex] !== undefined
      ? (typeof row[totalIndex] === 'number' ? row[totalIndex] : String(row[totalIndex]).trim())
      : availableSubjects.reduce((sum, subject) => sum + gradeValue(scores[subject]), 0);
    seen.add(name);
    students.push({
      id: students.length + 1,
      name,
      gender: '未设置',
      group: (students.length % 8) + 1,
      scores,
      total,
      attendance: '到校'
    });
  });
  if (!students.length) throw new Error(`没有找到“${expectedClass}”的数据`);
  return students;
}

export function parseScoreCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('文件中没有可导入的学生记录');
  const headers = splitCsvLine(lines[0]);
  const aliases = { name: ['姓名', '学生姓名', 'name'] };
  const nameIndex = headers.findIndex((header) => aliases.name.includes(header.toLowerCase()));
  const subjectIndexes = Object.fromEntries(gradeSubjects.map((subject) => [subject, headers.findIndex((header) => header === subject || header === `${subject}成绩`)]).filter(([, index]) => index >= 0));
  if (nameIndex < 0 || !['语文', '数学', '英语'].every((subject) => subjectIndexes[subject] >= 0)) throw new Error('表头需包含：姓名、语文、数学、英语');
  return lines.slice(1).map((line, rowIndex) => {
    const cells = splitCsvLine(line);
    const scores = Object.fromEntries(Object.entries(subjectIndexes).map(([subject, index]) => {
      const raw = cells[index];
      const numeric = Number(raw);
      const value = raw !== '' && Number.isFinite(numeric) ? numeric : raw;
      return [subject, value];
    }));
    if (!cells[nameIndex] || Object.values(scores).some((score) => !gradeValue(score) || (typeof score === 'number' && score > 150))) {
      throw new Error(`第 ${rowIndex + 2} 行姓名或成绩格式不正确`);
    }
    return { name: cells[nameIndex], scores };
  });
}

export function mergeScoreRows(students, rows) {
  let nextId = Math.max(0, ...students.map((student) => student.id)) + 1;
  const byName = new Map(students.map((student) => [student.name, student]));
  const importedNames = new Set(rows.map((row) => row.name));
  const merged = students.map((student) => {
    const row = rows.find((item) => item.name === student.name);
    if (!row) return student;
    const scores = { ...student.scores, ...row.scores };
    const total = Object.values(scores).every((score) => typeof score === 'number')
      ? Object.values(scores).reduce((sum, score) => sum + score, 0)
      : student.total;
    return { ...student, scores, total };
  });
  rows.forEach((row) => {
    if (byName.has(row.name)) return;
    const scores = row.scores;
    const total = Object.values(scores).every((score) => typeof score === 'number')
      ? Object.values(scores).reduce((sum, score) => sum + score, 0)
      : '—';
    merged.push({ id: nextId, name: row.name, gender: '未设置', group: 1, scores, total, attendance: '到校' });
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
