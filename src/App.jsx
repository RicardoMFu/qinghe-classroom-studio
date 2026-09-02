import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair, ArrowDown, ArrowUp, BarChart3, Bell, CalendarDays, Check, CircleAlert,
  ClipboardCheck, Download, GraduationCap, History, LayoutDashboard, Menu, Minus,
  Search, Sparkles, TrendingUp, Users, X
} from 'lucide-react';
import { dutyGroups, examTrend, initialTasks, students as seedStudents } from './data';
import {
  appendExam, createExamRecord, createStudent, getStudentExamChange, getStudentExamHistory,
  gradeOrder, gradeSubjects, gradeValue, isGradeScale, mergeScoreRows, migrateExamState,
  parseScoreCsv, studentPerformanceIndex, swapItems
} from './utils';
import { parseGradeWorkbook } from './importWorkbook';
import { cloudConfigured, loadCloudWorkspace, requestLogin, saveCloudWorkspace, subscribeToWorkspace, supabase } from './cloud';

const navItems = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
  { id: 'grades', label: '成绩', icon: BarChart3 },
  { id: 'seats', label: '座次', icon: Armchair },
  { id: 'students', label: '学生', icon: Users },
  { id: 'duty', label: '值日', icon: ClipboardCheck },
];

const readStored = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

function MetricCard({ label, value, detail, tone = 'green' }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Modal({ title, description, children, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="关闭弹窗"><X size={20} /></button></header>
        {children}
      </section>
    </div>
  );
}

function LoginScreen({ notify }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await requestLogin(email.trim());
      setSent(true);
      notify('登录链接已发送，请查看邮箱');
    } catch (error) {
      notify(error.message || '登录链接发送失败');
    } finally {
      setBusy(false);
    }
  };
  return <main className="login-page"><section className="login-card"><span className="brand-mark"><GraduationCap size={27} /></span><span className="eyebrow">重庆市涪陵第五中学</span><h1>七年级15班工作台</h1><p>学生数据仅对已授权账号开放。输入受邀邮箱，我们会发送一次性登录链接。</p>{sent ? <div className="login-sent"><Check size={20} /><div><strong>链接已发送</strong><span>请在同一设备打开邮件完成登录。</span></div></div> : <form onSubmit={submit}><label><span>受邀邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teacher@example.com" required /></label><button className="primary-button" type="submit" disabled={busy}>{busy ? '发送中…' : '发送登录链接'}</button></form>}<small>未授权访问者看不到学生姓名、成绩或座次。</small></section></main>;
}

function ChangeBadge({ value, gradeMode = false }) {
  if (value === null || value === undefined || value === 0) return <span className="change-badge neutral"><Minus size={13} />持平</span>;
  const positive = value > 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  const label = gradeMode ? `${Math.abs(value)} 档` : Math.abs(value);
  return <span className={`change-badge ${positive ? 'up' : 'down'}`}><Icon size={13} />{label}</span>;
}

function StudentHistoryModal({ student, exams, onClose }) {
  const [subject, setSubject] = useState('综合');
  const availableSubjects = gradeSubjects.filter((item) => exams.some((exam) => exam.students.some((entry) => entry.name === student.name && entry.scores?.[item] !== undefined)));
  const history = getStudentExamHistory(exams, student.name, subject);
  const maxValue = subject === '综合' ? 100 : Math.max(5, ...history.map((item) => item.numericValue));
  const points = history.map((item, index) => ({
    ...item,
    x: history.length === 1 ? 160 : 38 + index * (244 / (history.length - 1)),
    y: 128 - (item.numericValue / maxValue) * 92
  }));
  return <Modal title={`${student.name} · 成绩轨迹`} description="按考试顺序查看变化；等级变化表示档位升降，不等同于原始分数差。" onClose={onClose}>
    <div className="history-subjects" aria-label="选择个人成绩学科">{['综合', ...availableSubjects].map((item) => <button key={item} className={subject === item ? 'active' : ''} onClick={() => setSubject(item)}>{item}</button>)}</div>
    {history.length ? <>
      <div className="student-trend-chart" aria-label={`${student.name}${subject}历次成绩趋势`}>
        <svg viewBox="0 0 320 160" role="img">
          {[36, 82, 128].map((y) => <line key={y} x1="32" x2="288" y1={y} y2={y} className="chart-grid" />)}
          {points.length > 1 && <path d={`M ${points.map(({ x, y }) => `${x} ${y}`).join(' L ')}`} className="trend-line" />}
          {points.map(({ examId, examName, x, y, value }) => <g key={examId}><circle cx={x} cy={y} r="5" className="trend-dot" /><text x={x} y={y - 12} textAnchor="middle" className="chart-value">{value}</text><text x={x} y="153" textAnchor="middle" className="chart-label">{examName.length > 6 ? `${examName.slice(0, 6)}…` : examName}</text></g>)}
        </svg>
      </div>
      <div className="history-list">{history.map((item) => <article key={item.examId}><time>{item.date}</time><p><strong>{item.examName}</strong><small>{subject === '综合' ? '综合表现指数' : subject}</small></p><b>{subject === '综合' ? `${item.value}%` : item.value}</b><ChangeBadge value={item.change} gradeMode={subject !== '综合' && typeof item.value === 'string'} /></article>)}</div>
    </> : <div className="empty-state">该学生暂无可比较的成绩记录</div>}
  </Modal>;
}

function ExamImportModal({ onClose, onImport }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (!file) return setError('请选择成绩文件');
    setBusy(true);
    setError('');
    try {
      await onImport({ name, date, file });
      onClose();
    } catch (submitError) {
      setError(submitError.message || '成绩导入失败');
    } finally {
      setBusy(false);
    }
  };
  return <Modal title="录入一次考试" description="每次考试会独立保存，不会覆盖之前的记录。" onClose={onClose}>
    <form className="form-grid" onSubmit={submit}>
      <div className="form-row"><label><span>考试名称</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：第一次月考" required /></label><label><span>考试日期</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label></div>
      <label className="file-picker"><span>成绩文件</span><input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>{file ? `已选择：${file.name}` : '支持学校原始 Excel 或 CSV'}</small></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="privacy-note"><Check size={16} /><span>只读取姓名与成绩；身份号、学籍号、考号不会保存。</span></div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button" disabled={busy || !name.trim()}>{busy ? '正在读取…' : '保存本次考试'}</button></div>
    </form>
  </Modal>;
}

function TrendChart() {
  const points = examTrend.map((point, index) => {
    const x = 30 + index * 118;
    const y = 160 - (point.value - 76) * 9;
    return { ...point, x, y };
  });
  return (
    <div className="trend-wrap" aria-label="班级均分趋势图">
      <svg viewBox="0 0 540 200" role="img" aria-labelledby="trend-title">
        <title id="trend-title">五次考试班级均分从79.4分上升到86.7分</title>
        {[55, 95, 135].map((y) => <line key={y} x1="24" x2="516" y1={y} y2={y} className="chart-grid" />)}
        <path d={`M ${points.map(({ x, y }) => `${x} ${y}`).join(' L ')}`} className="trend-line" />
        <path d={`M ${points.map(({ x, y }) => `${x} ${y}`).join(' L ')} L 502 174 L 30 174 Z`} className="trend-area" />
        {points.map(({ label, value, x, y }) => (
          <g key={label}>
            <circle cx={x} cy={y} r="5" className="trend-dot" />
            <text x={x} y={y - 14} textAnchor="middle" className="chart-value">{value}</text>
            <text x={x} y="195" textAnchor="middle" className="chart-label">{label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function GradeProfile({ students }) {
  const values = students.flatMap((student) => Object.values(student.scores || {}).map(gradeValue).filter(Boolean));
  return <div className="grade-profile" aria-label="全班七科等级分布">{[...gradeOrder].reverse().map((label) => {
    const count = values.filter((value) => value === gradeValue(label)).length;
    const percent = values.length ? count / values.length * 100 : 0;
    return <div key={label}><span>{label}</span><i><b style={{ width: `${percent}%` }} /></i><strong>{percent.toFixed(0)}%</strong></div>;
  })}</div>;
}

function Dashboard({ tasks, setTasks, navigate, weekdayLabel, notify, students }) {
  const [addingTask, setAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const toggleTask = (id) => setTasks(tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  const submitTask = (event) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    setTasks([...tasks, { id: Date.now(), title: taskTitle.trim(), meta: '今天', priority: 'normal', done: false }]);
    setTaskTitle('');
    setAddingTask(false);
    notify('班务事项已添加');
  };
  const present = students.filter((student) => student.attendance === '到校').length;
  const late = students.filter((student) => student.attendance === '迟到').length;
  const leave = students.filter((student) => student.attendance === '请假').length;
  const gradeMode = isGradeScale(students);
  const scoreValues = students.flatMap((student) => Object.values(student.scores || {}).map(gradeValue).filter(Boolean));
  const average = gradeMode
    ? (scoreValues.length ? `${Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length / 5 * 100)}%` : '—')
    : (students.length ? (students.reduce((sum, student) => sum + Number(student.total || 0), 0) / students.length / 3).toFixed(1) : '—');
  const pending = tasks.filter((task) => !task.done).length;
  const followUp = students.filter((student) => Object.values(student.scores || {}).some((score) => gradeMode && gradeValue(score) <= 2) || student.attendance !== '到校').length;
  const completedTasks = tasks.filter((task) => task.done).length;
  return (
    <div className="page-grid">
      <section className="welcome-card reveal">
        <div>
          <span className="eyebrow">{weekdayLabel} · 教学第 3 周</span>
          <h1>早上好，班主任</h1>
          <p>班级整体平稳。今天有 {leave} 位学生请假，{pending} 项班务需要跟进。</p>
        </div>
        <div className="welcome-stamp" aria-hidden="true"><span>初一</span><strong>15</strong><span>班</span></div>
      </section>

      <section className="metrics-grid reveal delay-1" aria-label="班级概况">
        <MetricCard label="今日到校" value={`${present} / ${students.length}`} detail={`${leave} 请假 · ${late} 迟到`} />
        <MetricCard label={gradeMode ? '等级表现指数' : '当前均分'} value={average} detail={gradeMode ? '七科等级折算，仅供班内观察' : '语数英平均'} tone="gold" />
        <MetricCard label="待跟进学生" value={`${followUp} 人`} detail="等级偏低或缺勤" tone="blue" />
        <MetricCard label="班务完成" value={`${completedTasks} / ${tasks.length}`} detail={`${tasks.length ? Math.round(completedTasks / tasks.length * 100) : 0}% 已完成`} tone="coral" />
      </section>

      <section className="panel tasks-panel reveal delay-2">
        <div className="section-heading">
          <div><span className="eyebrow">今日节奏</span><h2>今天的班务</h2></div>
          <button className="text-button" onClick={() => setAddingTask(!addingTask)}>{addingTask ? '取消' : '+ 新增'}</button>
        </div>
        {addingTask && <form className="inline-add" onSubmit={submitTask}><label><span className="sr-only">班务内容</span><input autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="例如：确认运动会名单" /></label><button type="submit" disabled={!taskTitle.trim()}>添加</button></form>}
        <div className="task-list">
          {tasks.map((task) => (
            <button key={task.id} className={`task-row ${task.done ? 'is-done' : ''}`} onClick={() => toggleTask(task.id)}>
              <span className="check-circle">{task.done && <Check size={15} />}</span>
              <span className="task-copy"><strong>{task.title}</strong><small>{task.meta}</small></span>
              {task.priority === 'high' && <span className="urgent-tag">优先</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="panel trend-panel reveal delay-2">
        <div className="section-heading">
          <div><span className="eyebrow">{gradeMode ? '当前考试 · 七科汇总' : '最近 5 次考试'}</span><h2>{gradeMode ? '班级等级结构' : '班级均分趋势'}</h2></div>
          <button className="icon-button" aria-label="查看成绩详情" onClick={() => navigate('grades')}><BarChart3 size={19} /></button>
        </div>
        {gradeMode ? <GradeProfile students={students} /> : <TrendChart />}
      </section>

      <section className="panel attention-panel reveal delay-3">
        <div className="section-heading"><div><span className="eyebrow">智能提醒</span><h2>值得留意</h2></div><Sparkles size={19} className="accent-icon" /></div>
        <div className="insight"><span className="insight-icon coral"><CircleAlert size={18} /></span><p><strong>等级需关注</strong><small>{followUp} 位学生存在合格及以下成绩或缺勤</small></p><button onClick={() => navigate('students')}>查看</button></div>
        <div className="insight"><span className="insight-icon blue"><CalendarDays size={18} /></span><p><strong>今日到校</strong><small>{leave} 位请假 · {late} 位迟到</small></p><button onClick={() => navigate('students')}>查看</button></div>
      </section>

      <section className="panel quick-panel reveal delay-3">
        <div className="section-heading"><div><span className="eyebrow">常用工具</span><h2>一步直达</h2></div></div>
        <div className="quick-grid">
          {[['grades', BarChart3, '成绩分析'], ['seats', Armchair, '调整座次'], ['students', Users, '学生名册'], ['duty', ClipboardCheck, '今日值日']].map(([id, Icon, label]) => (
            <button key={id} onClick={() => navigate(id)}><Icon size={20} /><span>{label}</span></button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Grades({ notify, exams, activeExamId, setActiveExamId, onExamImported }) {
  const [subject, setSubject] = useState('总分');
  const [showAll, setShowAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null);
  const activeExam = exams.find((exam) => exam.id === activeExamId) || exams.at(-1);
  const students = activeExam?.students || [];
  const gradeMode = isGradeScale(students);
  const availableSubjects = gradeSubjects.filter((item) => students.some((student) => student.scores?.[item] !== undefined));
  const subjects = ['总分', ...availableSubjects];
  useEffect(() => {
    if (!subjects.includes(subject)) setSubject('总分');
  }, [activeExamId]);
  const scoreValue = (student) => subject === '总分'
    ? (gradeMode ? studentPerformanceIndex(student) : Number(student.total || 0))
    : gradeValue(student.scores?.[subject]);
  const displayValue = (student) => subject === '总分' && gradeMode
    ? `${studentPerformanceIndex(student) ?? '—'}%`
    : (subject === '总分' ? student.total : student.scores?.[subject] ?? '—');
  const ranked = useMemo(() => [...students].sort((a, b) => {
    return scoreValue(b) - scoreValue(a);
  }), [subject, students, gradeMode]);
  const values = ranked.map(scoreValue).filter((value) => value !== null && value !== undefined);
  const numericValues = values.filter((value) => Number.isFinite(value));
  const average = numericValues.length
    ? (gradeMode && subject !== '总分'
      ? `${Math.round(numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length / 5 * 100)}%`
      : `${(numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(1)}${gradeMode ? '%' : ''}`)
    : '—';
  const max = ranked.length ? displayValue(ranked[0]) : '—';
  const excellent = values.filter((value) => gradeMode ? value >= (subject === '总分' ? 80 : 4) : value >= (subject === '总分' ? 270 : 90)).length;
  const ranges = gradeMode && subject !== '总分'
    ? [...gradeOrder].reverse().map((label) => [label, gradeValue(label), gradeValue(label) + 1])
    : (subject === '总分'
      ? (gradeMode ? [['优秀', 80, 101], ['良好', 60, 80], ['需关注', 0, 60]] : [['优秀', 270, 1000], ['良好', 240, 270], ['中等', 210, 240], ['待提升', 0, 210]])
      : [['优秀', 90, 1000], ['良好', 80, 90], ['中等', 70, 80], ['待提升', 0, 70]]);
  const importGrades = async ({ name, date, file }) => {
    let imported;
    if (file.name.toLowerCase().endsWith('.xlsx')) {
      imported = await parseGradeWorkbook(file);
    } else {
      const rows = parseScoreCsv(await file.text());
      imported = mergeScoreRows([], rows).students;
    }
    const exam = createExamRecord({ name, date, students: imported, sourceName: file.name });
    onExamImported(exam);
    notify(`“${name}”已保存，共 ${imported.length} 名学生；此前考试仍保留`);
  };
  return (
    <div className="content-page">
      <header className="page-title"><div><span className="eyebrow">七年级15班 · 已记录 {exams.length} 次考试</span><h1>成绩分析</h1><p>切换考试、对比变化，再查看每位学生的历次轨迹。</p></div><button className="primary-button" onClick={() => setImporting(true)}><Download size={18} />录入一次考试</button></header>
      <section className="exam-toolbar" aria-label="成绩数据选择">
        <label><span>当前考试</span><select value={activeExam?.id || ''} onChange={(event) => setActiveExamId(event.target.value)}>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name} · {exam.date}</option>)}</select></label>
        <div><History size={18} /><p><strong>{activeExam?.name || '暂无考试'}</strong><small>{activeExam ? `${activeExam.date} · ${students.length} 人 · ${activeExam.sourceName || '手动录入'}` : '请先录入成绩'}</small></p></div>
      </section>
      <div className="format-hint"><span>历史不会被覆盖：</span>每次录入都会新建考试记录。支持学校原始 Excel，也可使用 <a href={`${import.meta.env.BASE_URL}成绩导入模板.csv`} download>CSV 模板</a></div>
      <div className="segmented" aria-label="选择学科">{subjects.map((item) => <button key={item} className={item === subject ? 'active' : ''} onClick={() => setSubject(item)}>{item}</button>)}</div>
      <section className="metrics-grid grades-metrics"><MetricCard label="参考人数" value={students.length} detail={activeExam?.name || '当前考试'} /><MetricCard label={gradeMode ? '表现指数' : '班级均分'} value={average} detail={subject === '总分' ? '各科综合' : subject} tone="gold" /><MetricCard label={gradeMode ? '最佳表现' : '最高分'} value={max} detail={ranked[0]?.name || '暂无'} tone="blue" /><MetricCard label={gradeMode ? '优良人数' : '优秀人数'} value={`${excellent} 人`} detail={`${students.length ? (excellent / students.length * 100).toFixed(1) : 0}%`} tone="coral" /></section>
      <div className="two-column">
        <section className="panel distribution-panel"><div className="section-heading"><div><span className="eyebrow">当前考试结构</span><h2>{gradeMode && subject !== '总分' ? '等级分布' : '表现分布'}</h2></div></div>
          <div className="distribution-list">{ranges.map(([label, min, upper], index) => { const count = values.filter((v) => v >= min && v < upper).length; const percent = students.length ? count / students.length * 100 : 0; return <div key={label} className="distribution-row"><span>{label}<small>{count} 人</small></span><div><i style={{ width: `${Math.max(3, percent)}%` }} data-tone={index} /></div><strong>{percent.toFixed(0)}%</strong></div>; })}</div>
        </section>
        <section className="panel ranking-panel"><div className="section-heading"><div><span className="eyebrow">点击学生查看历次轨迹</span><h2>班级排名与变化</h2></div><button className="text-button" onClick={() => setShowAll(!showAll)}>{showAll ? '收起' : '查看全部'}</button></div>
          <div className="rank-list">{ranked.slice(0, showAll ? ranked.length : 8).map((student, index) => { const change = getStudentExamChange(exams, activeExam?.id, student.name, subject === '总分' ? '综合' : subject); return <button className="rank-row rank-button" key={student.id} onClick={() => setHistoryStudent(student)}><span className="rank-number">{index + 1}</span><span className="avatar">{student.name.slice(-1)}</span><p><strong>{student.name}</strong><small>{change === null ? '暂无上次记录' : '相对上一次'}</small></p><ChangeBadge value={change} gradeMode={gradeMode && subject !== '总分'} /><b>{displayValue(student)}</b></button>; })}</div>
        </section>
      </div>
      {!exams.length && <section className="panel empty-exams"><TrendingUp size={28} /><h2>还没有考试记录</h2><p>录入第一次考试后，这里会自动生成班级分析与个人轨迹。</p><button className="primary-button" onClick={() => setImporting(true)}>录入第一次考试</button></section>}
      {importing && <ExamImportModal onClose={() => setImporting(false)} onImport={importGrades} />}
      {historyStudent && <StudentHistoryModal student={historyStudent} exams={exams} onClose={() => setHistoryStudent(null)} />}
    </div>
  );
}

function Seats({ seats, setSeats, students }) {
  const [selected, setSelected] = useState(null);
  const clickSeat = (index) => {
    if (selected === null) return setSelected(index);
    if (selected === index) return setSelected(null);
    setSeats(swapItems(seats, selected, index));
    setSelected(null);
  };
  return (
    <div className="content-page">
      <header className="page-title"><div><span className="eyebrow">{seats.length} 人 · 每排 6 座</span><h1>座次安排</h1><p>依次点选两位学生即可交换座位，刷新后仍会保留。</p></div><button className="secondary-button" onClick={() => { setSeats(students); setSelected(null); }}>恢复名册顺序</button></header>
      <section className="panel seating-panel">
        <div className="board"><span>讲 台</span><small>黑板方向</small></div>
        <div className="seat-grid">{seats.map((student, index) => <button key={student.id} className={`seat ${selected === index ? 'selected' : ''}`} onClick={() => clickSeat(index)} aria-label={`${student.name}，第${Math.floor(index / 6) + 1}排第${index % 6 + 1}列`}><span>{student.name}</span><small>{index + 1} 号</small></button>)}</div>
        <div className="seat-legend"><span><i className="legend-dot selected-dot" />已选中</span><span><i className="legend-dot normal-dot" />普通座位</span><p>{selected === null ? '点选一位学生开始调整' : `已选择 ${seats[selected].name}，再点一位即可交换`}</p></div>
      </section>
    </div>
  );
}

function Students({ notify, students, onAddStudent }) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', gender: '未设置', group: 1 });
  const [formError, setFormError] = useState('');
  const filtered = students.filter((student) => student.name.includes(query) || String(student.id).includes(query));
  const subjects = gradeSubjects.filter((subject) => students.some((student) => student.scores?.[subject] !== undefined));
  const submitStudent = (event) => {
    event.preventDefault();
    try {
      const student = createStudent(form, students);
      onAddStudent(student);
      setAdding(false);
      setForm({ name: '', gender: '未设置', group: 1 });
      setFormError('');
      notify(`${student.name} 已加入名册和座次表`);
    } catch (error) {
      setFormError(error.message);
    }
  };
  return (
    <div className="content-page">
      <header className="page-title"><div><span className="eyebrow">七年级15班 · {students.length} 人</span><h1>学生名册</h1><p>快速查找、观察成绩与到校状态。</p></div><button className="primary-button" onClick={() => setAdding(true)}>+ 新增学生</button></header>
      <label className="search-box"><Search size={18} /><span className="sr-only">搜索学生</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="按姓名或学号查找" /></label>
      <section className="panel student-table-wrap"><table className="student-table"><thead><tr><th>学生</th><th>序号</th><th>小组</th>{subjects.map((subject) => <th key={subject}>{subject}</th>)}<th>到校</th></tr></thead><tbody>{filtered.map((student) => <tr key={student.id}><td><span className="avatar small">{student.name.slice(-1)}</span><strong>{student.name}</strong></td><td>{String(student.id).padStart(2, '0')}</td><td>{student.group} 组</td>{subjects.map((subject) => <td key={subject}>{student.scores?.[subject] ?? '—'}</td>)}<td><span className={`status ${student.attendance !== '到校' ? 'warning' : ''}`}>{student.attendance}</span></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state">没有找到匹配的学生</div>}</section>
      {adding && <Modal title="新增学生" description="只需填写最基本信息，成绩可稍后批量导入。" onClose={() => { setAdding(false); setFormError(''); }}><form className="form-grid" onSubmit={submitStudent}><label><span>学生姓名</span><input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="请输入姓名" /></label><div className="form-row"><label><span>性别</span><select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option>未设置</option><option>男</option><option>女</option></select></label><label><span>小组</span><select value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value })}>{Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>第 {index + 1} 组</option>)}</select></label></div>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setAdding(false)}>取消</button><button type="submit" className="primary-button">保存学生</button></div></form></Modal>}
    </div>
  );
}

function Duty({ notify, schedule, setSchedule }) {
  const day = new Date().getDay();
  const activeIndex = Math.min(4, Math.max(0, day - 1));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(schedule);
  const openEditor = () => { setDraft(schedule.map((item) => ({ ...item }))); setEditing(true); };
  const saveSchedule = (event) => { event.preventDefault(); setSchedule(draft); setEditing(false); notify('值日安排已保存'); };
  return (
    <div className="content-page">
      <header className="page-title"><div><span className="eyebrow">本周安排</span><h1>值日表</h1><p>职责清楚，临时调换也能一眼确认。</p></div><button className="primary-button" onClick={openEditor}>调整安排</button></header>
      <section className="duty-hero"><div><span>今日值日</span><h2>{schedule[activeIndex].group}</h2><p>{schedule[activeIndex].area}</p></div><div className="duty-lead"><small>值日组长</small><strong>{schedule[activeIndex].lead}</strong><span>放学后 17:20 前完成</span></div></section>
      <section className="panel duty-panel"><div className="section-heading"><div><span className="eyebrow">轮值顺序</span><h2>一周值日安排</h2></div></div><div className="duty-list">{schedule.map((item, index) => <article className={index === activeIndex ? 'today' : ''} key={item.day}><span className="day-chip">{item.day}</span><p><strong>{item.group}</strong><small>{item.area}</small></p><span>{item.lead}</span>{index === activeIndex && <b>今天</b>}</article>)}</div></section>
      {editing && <Modal title="调整值日安排" description="修改后一次保存，避免误触。" onClose={() => setEditing(false)}><form className="duty-editor" onSubmit={saveSchedule}>{draft.map((item, index) => <fieldset key={item.day}><legend>{item.day}</legend><label><span>值日组</span><input value={item.group} onChange={(event) => setDraft(draft.map((entry, entryIndex) => entryIndex === index ? { ...entry, group: event.target.value } : entry))} /></label><label><span>组长</span><input value={item.lead} onChange={(event) => setDraft(draft.map((entry, entryIndex) => entryIndex === index ? { ...entry, lead: event.target.value } : entry))} /></label><label className="wide"><span>负责区域</span><input value={item.area} onChange={(event) => setDraft(draft.map((entry, entryIndex) => entryIndex === index ? { ...entry, area: event.target.value } : entry))} /></label></fieldset>)}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)}>取消</button><button type="submit" className="primary-button">保存安排</button></div></form></Modal>}
    </div>
  );
}

export default function App() {
  const initialPage = window.location.hash.replace('#/', '') || 'dashboard';
  const [page, setPage] = useState(navItems.some((item) => item.id === initialPage) ? initialPage : 'dashboard');
  const [tasks, setTasks] = useState(() => readStored('qinghe.tasks', initialTasks));
  const [students, setStudents] = useState(() => readStored('qinghe.students.v1', seedStudents));
  const [examState, setExamState] = useState(() => migrateExamState(readStored('qinghe.exams.v1', null), readStored('qinghe.students.v1', seedStudents)));
  const [seats, setSeats] = useState(() => readStored('qinghe.seats.v3', seedStudents));
  const [schedule, setSchedule] = useState(() => readStored('qinghe.duty.v1', dutyGroups));
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!cloudConfigured);
  const [cloudMeta, setCloudMeta] = useState(null);
  const [syncState, setSyncState] = useState(cloudConfigured ? '等待登录' : '本机演示');
  const revisionRef = useRef(0);
  const skipSaveRef = useRef(false);
  const saveTimerRef = useRef(null);
  const now = new Date();
  const currentDateLabel = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(now);
  const weekdayLabel = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(now);
  const activeExam = examState.exams.find((exam) => exam.id === examState.activeExamId) || examState.exams.at(-1);
  const activeStudents = activeExam?.students || students;

  const navigate = (id) => { setPage(id); setMobileMenu(false); window.location.hash = `/${id}`; window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const notify = (message) => {
    setToast(message);
    window.clearTimeout(window.__qingheToastTimer);
    window.__qingheToastTimer = window.setTimeout(() => setToast(''), 3200);
  };
  const syncStudents = (nextStudents) => {
    setStudents(nextStudents);
    setSeats((currentSeats) => {
      const validIds = new Set(nextStudents.map((student) => student.id));
      const kept = currentSeats.filter((student) => validIds.has(student.id));
      const seatedIds = new Set(kept.map((student) => student.id));
      return [...kept, ...nextStudents.filter((student) => !seatedIds.has(student.id))];
    });
  };
  const addStudent = (student) => syncStudents([...students, student]);
  const addExam = (exam) => {
    if (examState.exams.some((item) => item.name === exam.name && item.date === exam.date)) {
      throw new Error('同一天已有同名考试，请修改考试名称后再保存');
    }
    setExamState((current) => ({ exams: appendExam(current.exams, exam), activeExamId: exam.id }));
    syncStudents(exam.students);
  };
  useEffect(() => { if (!cloudConfigured) localStorage.setItem('qinghe.tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { if (!cloudConfigured) localStorage.setItem('qinghe.students.v1', JSON.stringify(students)); }, [students]);
  useEffect(() => { if (!cloudConfigured) localStorage.setItem('qinghe.exams.v1', JSON.stringify(examState)); }, [examState]);
  useEffect(() => { if (!cloudConfigured) localStorage.setItem('qinghe.seats.v3', JSON.stringify(seats)); }, [seats]);
  useEffect(() => { if (!cloudConfigured) localStorage.setItem('qinghe.duty.v1', JSON.stringify(schedule)); }, [schedule]);
  useEffect(() => { const handler = () => { const id = window.location.hash.replace('#/', '') || 'dashboard'; if (navItems.some((item) => item.id === id)) setPage(id); }; window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);

  useEffect(() => {
    if (!cloudConfigured) return undefined;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!cloudConfigured || !session) return undefined;
    let active = true;
    let unsubscribe = () => {};
    const applyRemote = (state) => {
      const payload = state.payload || {};
      const migratedExams = migrateExamState({ exams: payload.exams, activeExamId: payload.activeExamId }, payload.students || []);
      skipSaveRef.current = true;
      setStudents(payload.students || []);
      setExamState(migratedExams);
      setSeats(payload.seats || payload.students || []);
      setTasks(payload.tasks || []);
      setSchedule(payload.schedule?.length ? payload.schedule : dutyGroups);
      revisionRef.current = Number(state.revision || 0);
      setSyncState('已同步');
    };
    setSyncState('正在同步…');
    loadCloudWorkspace().then(({ membership, state }) => {
      if (!active) return;
      setCloudMeta(membership);
      applyRemote(state);
      unsubscribe = subscribeToWorkspace(membership.classroom_id, (nextState) => {
        if (Number(nextState.revision) > revisionRef.current) applyRemote(nextState);
      });
    }).catch((error) => {
      setSyncState('同步失败');
      notify(error.message || '无法读取班级数据');
    });
    return () => { active = false; unsubscribe(); };
  }, [session]);

  useEffect(() => {
    if (!cloudConfigured || !session || !cloudMeta) return undefined;
    if (skipSaveRef.current) { skipSaveRef.current = false; return undefined; }
    if (cloudMeta.role === 'viewer') return undefined;
    window.clearTimeout(saveTimerRef.current);
    setSyncState('有更改待同步');
    saveTimerRef.current = window.setTimeout(async () => {
      setSyncState('正在同步…');
      try {
        const saved = await saveCloudWorkspace(cloudMeta.classroom_id, revisionRef.current, { students, exams: examState.exams, activeExamId: examState.activeExamId, seats, tasks, schedule });
        revisionRef.current = Number(saved.revision);
        setSyncState('已同步');
      } catch (error) {
        setSyncState('同步冲突');
        try {
          const { state } = await loadCloudWorkspace();
          const migratedExams = migrateExamState({ exams: state.payload.exams, activeExamId: state.payload.activeExamId }, state.payload.students || []);
          skipSaveRef.current = true;
          setStudents(state.payload.students || []);
          setExamState(migratedExams);
          setSeats(state.payload.seats || state.payload.students || []);
          setTasks(state.payload.tasks || []);
          setSchedule(state.payload.schedule?.length ? state.payload.schedule : dutyGroups);
          revisionRef.current = Number(state.revision);
          setSyncState('已载入其他人的最新版本');
          notify('检测到其他人同时修改，已载入最新版本，请重新操作');
        } catch {
          notify(error.message || '同步失败，请稍后重试');
        }
      }
    }, 700);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [students, examState, seats, tasks, schedule, session, cloudMeta]);

  if (!authReady) return <main className="login-page"><section className="login-card"><p>正在检查登录状态…</p></section></main>;
  if (cloudConfigured && !session) return <><LoginScreen notify={notify} />{toast && <div className="toast" role="status" aria-live="polite"><Check size={17} />{toast}</div>}</>;

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">跳到主要内容</a>
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <div className="brand"><span className="brand-mark"><GraduationCap size={25} /></span><div><strong>青禾</strong><small>班主任工作台</small></div><button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="关闭菜单"><X /></button></div>
        <div className="class-card"><span>{cloudMeta?.classrooms?.grade_label || '七年级'} · {cloudMeta?.classrooms?.name || '15班'}</span><strong>{cloudMeta?.classrooms?.school || '重庆市涪陵第五中学'}</strong></div>
        <nav aria-label="主要导航">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={20} /><span>{label}</span></button>)}</nav>
        <div className="sidebar-note"><span><Sparkles size={16} /> {syncState}</span><p>{cloudConfigured ? '班级成员共享最新数据' : '当前为本机演示数据'}</p></div>
        <div className="teacher-card"><span className="avatar teacher">班</span><p><strong>班主任</strong><small>{cloudMeta?.role === 'viewer' ? '只读成员' : '可编辑成员'}</small></p>{cloudConfigured && <button className="signout-button" onClick={() => supabase.auth.signOut()}>退出</button>}</div>
      </aside>
      <main id="main" className="main-area">
        <header className="topbar"><button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="打开菜单"><Menu /></button><div className="topbar-title"><span>{currentDateLabel}</span><strong>{navItems.find((item) => item.id === page)?.label}</strong></div><div className="top-actions"><button aria-label="通知" onClick={() => notify('暂无新的班务通知')}><Bell size={20} /><i /></button><button className="quick-record" onClick={() => navigate('grades')}>快速录入</button></div></header>
        <div className="page-container">
          {page === 'dashboard' && <Dashboard tasks={tasks} setTasks={setTasks} navigate={navigate} weekdayLabel={weekdayLabel} notify={notify} students={activeStudents} />}
          {page === 'grades' && <Grades notify={notify} exams={examState.exams} activeExamId={examState.activeExamId} setActiveExamId={(activeExamId) => setExamState((current) => ({ ...current, activeExamId }))} onExamImported={addExam} />}
          {page === 'seats' && <Seats seats={seats} setSeats={setSeats} students={students} />}
          {page === 'students' && <Students notify={notify} students={activeStudents} onAddStudent={addStudent} />}
          {page === 'duty' && <Duty notify={notify} schedule={schedule} setSchedule={setSchedule} />}
        </div>
      </main>
      <nav className="bottom-nav" aria-label="移动端主要导航">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={20} /><span>{label}</span></button>)}</nav>
      {toast && <div className="toast" role="status" aria-live="polite"><Check size={17} />{toast}</div>}
    </div>
  );
}
