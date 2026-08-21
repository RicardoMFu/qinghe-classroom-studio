const names = [
  '林知夏', '陈屿川', '周予安', '许清和', '沈景行', '顾星遥', '江云舟', '夏舒然',
  '叶砚秋', '陆嘉木', '苏念初', '唐时雨', '温言蹊', '宋南乔', '梁书意', '徐望舒',
  '程星野', '韩若溪', '吴以宁', '郑闻笙', '何慕青', '高远山', '罗景明', '谢听澜',
  '郭云舒', '马知远', '曹语桐', '彭乐仪', '邓思齐', '冯亦辰', '朱芷晴', '曾嘉树',
  '邱雨眠', '蒋明澈', '余清越', '潘可昕', '蔡承宇', '杜安然', '范星冉', '汪予墨',
  '方一诺', '石明轩', '姚静姝', '任书航', '廖可为', '孔令仪', '白嘉禾', '董思源'
];

export const students = Array.from({ length: 48 }, (_, index) => {
  const chinese = 76 + ((index * 7) % 23);
  const math = 70 + ((index * 11) % 30);
  const english = 74 + ((index * 13) % 26);
  return {
    id: index + 1,
    name: names[index],
    gender: index % 2 ? '女' : '男',
    group: (index % 8) + 1,
    scores: { 语文: chinese, 数学: math, 英语: english },
    total: chinese + math + english,
    attendance: index === 14 ? '请假' : index === 32 ? '迟到' : '到校'
  };
});

export const initialTasks = [
  { id: 1, title: '确认运动会接力名单', meta: '今天 12:00 前', priority: 'high', done: false },
  { id: 2, title: '批阅周记并记录谈心线索', meta: '今天放学前', priority: 'normal', done: false },
  { id: 3, title: '向家长发送周五家长会提醒', meta: '明天', priority: 'normal', done: false }
];

export const examTrend = [
  { label: '入学测', value: 79.4 },
  { label: '9月月考', value: 81.8 },
  { label: '期中', value: 83.1 },
  { label: '12月月考', value: 82.5 },
  { label: '期末', value: 86.7 }
];

export const dutyGroups = [
  { day: '周一', group: '第一组', area: '教室地面 · 走廊', lead: '林知夏' },
  { day: '周二', group: '第二组', area: '黑板 · 讲台 · 门窗', lead: '陈屿川' },
  { day: '周三', group: '第三组', area: '教室地面 · 垃圾分类', lead: '周予安' },
  { day: '周四', group: '第四组', area: '公共区域 · 绿植', lead: '许清和' },
  { day: '周五', group: '第五组', area: '全班大扫除', lead: '沈景行' }
];
