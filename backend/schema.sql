-- SmartLearn AI — PostgreSQL reference schema (generated from the SQLAlchemy models)
-- ---------------------------------------------------------------------------
-- The application creates these tables automatically on startup via
-- Base.metadata.create_all(). This file is a reference for DBAs and for
-- provisioning PostgreSQL manually. JSON columns map cleanly to JSONB;
-- use SQLite for a zero-configuration local setup.
--
-- Create the database first, then:
--   psql -U smartlearn -d smartlearn -f schema.sql
-- ---------------------------------------------------------------------------


CREATE TABLE users (
	id SERIAL NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	full_name VARCHAR(150) NOT NULL, 
	role VARCHAR(20) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	last_login TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
)



CREATE UNIQUE INDEX ix_users_email ON users (email)


CREATE TABLE skills (
	skill_id VARCHAR(80) NOT NULL, 
	skill_name VARCHAR(150) NOT NULL, 
	category VARCHAR(80) NOT NULL, 
	level VARCHAR(30) NOT NULL, 
	description TEXT NOT NULL, 
	aliases TEXT NOT NULL, 
	PRIMARY KEY (skill_id)
)



CREATE INDEX ix_skills_category ON skills (category)


CREATE TABLE career_roles (
	role_id VARCHAR(80) NOT NULL, 
	title VARCHAR(150) NOT NULL, 
	category VARCHAR(80) NOT NULL, 
	description TEXT NOT NULL, 
	required_skills JSON NOT NULL, 
	core_skills JSON NOT NULL, 
	advanced_skills JSON NOT NULL, 
	phase_titles JSON NOT NULL, 
	phase_skills JSON NOT NULL, 
	onet_code VARCHAR(40), 
	esco_uri VARCHAR(300), 
	demand_outlook TEXT, 
	keywords TEXT NOT NULL, 
	PRIMARY KEY (role_id)
)



CREATE INDEX ix_career_roles_category ON career_roles (category)


CREATE TABLE courses (
	course_id VARCHAR(100) NOT NULL, 
	title VARCHAR(250) NOT NULL, 
	description TEXT NOT NULL, 
	skills JSON NOT NULL, 
	category VARCHAR(80) NOT NULL, 
	difficulty VARCHAR(30) NOT NULL, 
	platform VARCHAR(100) NOT NULL, 
	url VARCHAR(500) NOT NULL, 
	link_type VARCHAR(30) NOT NULL, 
	duration_hours FLOAT, 
	duration_is_estimate BOOLEAN NOT NULL, 
	price_type VARCHAR(30) NOT NULL, 
	price_usd FLOAT, 
	price_note VARCHAR(200) NOT NULL, 
	language VARCHAR(60) NOT NULL, 
	prerequisites JSON NOT NULL, 
	certificate BOOLEAN NOT NULL, 
	rating FLOAT, 
	rating_count INTEGER, 
	verified BOOLEAN NOT NULL, 
	verification_note VARCHAR(300) NOT NULL, 
	learning_type VARCHAR(40) NOT NULL, 
	last_checked VARCHAR(40), 
	is_active BOOLEAN NOT NULL, 
	PRIMARY KEY (course_id)
)



CREATE INDEX ix_courses_category ON courses (category)

CREATE INDEX ix_courses_platform ON courses (platform)


CREATE TABLE projects (
	project_id VARCHAR(100) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT NOT NULL, 
	career_role VARCHAR(100) NOT NULL, 
	skills JSON NOT NULL, 
	difficulty VARCHAR(30) NOT NULL, 
	duration_hours FLOAT NOT NULL, 
	project_type VARCHAR(20) NOT NULL, 
	deliverables TEXT NOT NULL, 
	github_url VARCHAR(400), 
	reference_url VARCHAR(400), 
	PRIMARY KEY (project_id)
)



CREATE INDEX ix_projects_career_role ON projects (career_role)


CREATE TABLE learning_resources (
	resource_id VARCHAR(100) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	resource_type VARCHAR(60) NOT NULL, 
	url VARCHAR(500) NOT NULL, 
	skills JSON NOT NULL, 
	platform VARCHAR(120) NOT NULL, 
	price_type VARCHAR(30) NOT NULL, 
	description TEXT NOT NULL, 
	PRIMARY KEY (resource_id)
)




CREATE TABLE student_profiles (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	age INTEGER, 
	country VARCHAR(100), 
	preferred_language VARCHAR(60) NOT NULL, 
	college_name VARCHAR(200), 
	degree VARCHAR(120), 
	department VARCHAR(120), 
	current_year VARCHAR(20), 
	current_semester VARCHAR(20), 
	cgpa VARCHAR(20), 
	academic_subjects JSON NOT NULL, 
	previous_qualifications TEXT, 
	programming_languages JSON NOT NULL, 
	frameworks JSON NOT NULL, 
	tools JSON NOT NULL, 
	databases JSON NOT NULL, 
	technical_skills JSON NOT NULL, 
	soft_skills JSON NOT NULL, 
	desired_role VARCHAR(150), 
	career_role_id VARCHAR(80), 
	interested_industries JSON NOT NULL, 
	preferred_positions JSON NOT NULL, 
	short_term_goal TEXT, 
	long_term_goal TEXT, 
	previous_projects TEXT, 
	internships TEXT, 
	certifications TEXT, 
	work_experience TEXT, 
	portfolio_url VARCHAR(300), 
	proficiency_level VARCHAR(30) NOT NULL, 
	budget_pref VARCHAR(30) NOT NULL, 
	preferred_platforms JSON NOT NULL, 
	learning_style VARCHAR(40) NOT NULL, 
	course_language VARCHAR(60) NOT NULL, 
	hours_per_day FLOAT NOT NULL, 
	days_per_week INTEGER NOT NULL, 
	target_completion_date DATE, 
	parallel_learning BOOLEAN NOT NULL, 
	onboarding_completed BOOLEAN NOT NULL, 
	profile_completeness INTEGER NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(career_role_id) REFERENCES career_roles (role_id)
)



CREATE UNIQUE INDEX ix_student_profiles_user_id ON student_profiles (user_id)


CREATE TABLE skill_prerequisites (
	id SERIAL NOT NULL, 
	skill_id VARCHAR(80) NOT NULL, 
	prerequisite_skill_id VARCHAR(80) NOT NULL, 
	strength VARCHAR(20) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_skill_prereq UNIQUE (skill_id, prerequisite_skill_id), 
	FOREIGN KEY(skill_id) REFERENCES skills (skill_id), 
	FOREIGN KEY(prerequisite_skill_id) REFERENCES skills (skill_id)
)



CREATE INDEX ix_skill_prerequisites_prerequisite_skill_id ON skill_prerequisites (prerequisite_skill_id)

CREATE INDEX ix_skill_prerequisites_skill_id ON skill_prerequisites (skill_id)


CREATE TABLE roadmaps (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	career_goal VARCHAR(150) NOT NULL, 
	career_role_id VARCHAR(80), 
	current_level VARCHAR(30) NOT NULL, 
	target_level VARCHAR(30) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	generated_by VARCHAR(40) NOT NULL, 
	summary TEXT NOT NULL, 
	skill_gap JSON NOT NULL, 
	total_hours FLOAT NOT NULL, 
	total_weeks INTEGER NOT NULL, 
	start_date DATE, 
	expected_completion DATE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)



CREATE INDEX ix_roadmaps_user_id ON roadmaps (user_id)


CREATE TABLE course_progress (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	course_id VARCHAR(100) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	progress_percent INTEGER NOT NULL, 
	hours_spent FLOAT NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	notes TEXT, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_course_progress UNIQUE (user_id, course_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(course_id) REFERENCES courses (course_id)
)



CREATE INDEX ix_course_progress_course_id ON course_progress (course_id)

CREATE INDEX ix_course_progress_user_id ON course_progress (user_id)


CREATE TABLE project_progress (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	project_id VARCHAR(100) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	hours_spent FLOAT NOT NULL, 
	repository_url VARCHAR(400), 
	notes TEXT, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_project_progress UNIQUE (user_id, project_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(project_id) REFERENCES projects (project_id)
)



CREATE INDEX ix_project_progress_project_id ON project_progress (project_id)

CREATE INDEX ix_project_progress_user_id ON project_progress (user_id)


CREATE TABLE chat_conversations (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	title VARCHAR(150) NOT NULL, 
	context_node_key VARCHAR(150), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)



CREATE INDEX ix_chat_conversations_user_id ON chat_conversations (user_id)


CREATE TABLE activity_logs (
	id SERIAL NOT NULL, 
	user_id INTEGER, 
	action VARCHAR(80) NOT NULL, 
	detail TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
)



CREATE INDEX ix_activity_logs_action ON activity_logs (action)


CREATE TABLE roadmap_nodes (
	id SERIAL NOT NULL, 
	roadmap_id INTEGER NOT NULL, 
	node_key VARCHAR(150) NOT NULL, 
	node_type VARCHAR(30) NOT NULL, 
	title VARCHAR(250) NOT NULL, 
	description TEXT NOT NULL, 
	phase_number INTEGER, 
	duration_hours FLOAT NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	course_id VARCHAR(100), 
	project_id VARCHAR(100), 
	prerequisites JSON NOT NULL, 
	skills JSON NOT NULL, 
	parent_key VARCHAR(150), 
	order_index INTEGER NOT NULL, 
	meta JSON NOT NULL, 
	score FLOAT, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_roadmap_node_key UNIQUE (roadmap_id, node_key), 
	FOREIGN KEY(roadmap_id) REFERENCES roadmaps (id) ON DELETE CASCADE, 
	FOREIGN KEY(course_id) REFERENCES courses (course_id), 
	FOREIGN KEY(project_id) REFERENCES projects (project_id)
)



CREATE INDEX ix_roadmap_nodes_roadmap_id ON roadmap_nodes (roadmap_id)


CREATE TABLE node_progress (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	roadmap_id INTEGER NOT NULL, 
	node_key VARCHAR(150) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	notes TEXT, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_roadmap_node_progress UNIQUE (user_id, roadmap_id, node_key), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(roadmap_id) REFERENCES roadmaps (id) ON DELETE CASCADE
)



CREATE INDEX ix_node_progress_user_id ON node_progress (user_id)

CREATE INDEX ix_node_progress_roadmap_id ON node_progress (roadmap_id)


CREATE TABLE assessment_attempts (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	roadmap_id INTEGER NOT NULL, 
	node_key VARCHAR(150) NOT NULL, 
	score FLOAT NOT NULL, 
	passed BOOLEAN NOT NULL, 
	attempted_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(roadmap_id) REFERENCES roadmaps (id) ON DELETE CASCADE
)



CREATE INDEX ix_assessment_attempts_user_id ON assessment_attempts (user_id)

CREATE INDEX ix_assessment_attempts_roadmap_id ON assessment_attempts (roadmap_id)


CREATE TABLE chat_messages (
	id SERIAL NOT NULL, 
	conversation_id INTEGER NOT NULL, 
	role VARCHAR(20) NOT NULL, 
	content TEXT NOT NULL, 
	sources JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(conversation_id) REFERENCES chat_conversations (id) ON DELETE CASCADE
)



CREATE INDEX ix_chat_messages_conversation_id ON chat_messages (conversation_id)