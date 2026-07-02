-- Scratch 教学工作台 数据库 Schema v1
-- 适配 SQLite

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 学生
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_path TEXT,
  grade TEXT,
  tags TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 班级
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'regular',
  schedule_rule TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 班级成员关联
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  total_score INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  UNIQUE(student_id, class_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);

-- 点子库
CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_course TEXT,
  description TEXT,
  status TEXT DEFAULT 'idea',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 点子版本
CREATE TABLE IF NOT EXISTS idea_versions (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  version_name TEXT NOT NULL,
  file_path TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_idea_versions_idea ON idea_versions(idea_id);

-- 教案（与点子版本 1:1 关联，结构化备课内容）
CREATE TABLE IF NOT EXISTS lesson_plans (
  id TEXT PRIMARY KEY,
  idea_version_id TEXT NOT NULL UNIQUE,
  title TEXT,
  objectives TEXT,
  key_points TEXT,
  preparation TEXT,
  process TEXT,
  reflection TEXT,
  duration_minutes INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (idea_version_id) REFERENCES idea_versions(id) ON DELETE CASCADE
);

-- 课次
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  idea_version_id TEXT,
  subject TEXT,
  status TEXT DEFAULT 'pending',
  feedback_sent INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (idea_version_id) REFERENCES idea_versions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_lessons_class ON lessons(class_id);
CREATE INDEX IF NOT EXISTS idx_lessons_time ON lessons(start_time);

-- 课堂记录
CREATE TABLE IF NOT EXISTS lesson_records (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  score_change INTEGER DEFAULT 0,
  participation_note TEXT,
  is_picked INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_records_lesson ON lesson_records(lesson_id);
CREATE INDEX IF NOT EXISTS idx_records_student ON lesson_records(student_id);

-- 待办
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'todo',
  ref_lesson_id TEXT,
  ref_idea_id TEXT,
  due_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);

-- 资源库
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  class_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);

-- 反馈/报告
CREATE TABLE IF NOT EXISTS feedbacks (
  id TEXT PRIMARY KEY,
  lesson_id TEXT,
  class_id TEXT NOT NULL,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  content TEXT,
  ai_report TEXT,
  status TEXT DEFAULT 'draft',
  sent_at DATETIME,
  sent_channel TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feedbacks_class ON feedbacks(class_id);

-- 文档链接（语雀等关联到课次）
CREATE TABLE IF NOT EXISTS doc_links (
  id TEXT PRIMARY KEY,
  lesson_id TEXT,
  url TEXT NOT NULL,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

-- 设置（键值存储）
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 同步状态（增量同步用）
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_push_at DATETIME,
  last_pull_at DATETIME,
  last_error TEXT,
  device_id TEXT
);

-- updated_at 触发器
CREATE TRIGGER IF NOT EXISTS trg_students_updated
  AFTER UPDATE ON students FOR EACH ROW
  BEGIN UPDATE students SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_classes_updated
  AFTER UPDATE ON classes FOR EACH ROW
  BEGIN UPDATE classes SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_ideas_updated
  AFTER UPDATE ON ideas FOR EACH ROW
  BEGIN UPDATE ideas SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_feedbacks_updated
  AFTER UPDATE ON feedbacks FOR EACH ROW
  BEGIN UPDATE feedbacks SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_lesson_plans_updated
  AFTER UPDATE ON lesson_plans FOR EACH ROW
  BEGIN UPDATE lesson_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;

-- 反馈模板（内置 + 自定义）
CREATE TABLE IF NOT EXISTS feedback_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  content TEXT NOT NULL,
  is_builtin INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fb_templates_category ON feedback_templates(category);

-- 教案模板（用户自定义；内置模板仍由静态数据提供）
CREATE TABLE IF NOT EXISTS lesson_plan_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  description TEXT,
  duration_minutes INTEGER,
  objectives TEXT,
  key_points TEXT,
  preparation TEXT,
  process TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lp_templates_category ON lesson_plan_templates(category);
