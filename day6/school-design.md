
# School Database Design

## 1. Table Explanations

### Students Table

The `students` table stores information about each student. It contains `student_id`, which is the primary key, `full_name`, and `email`. The student ID uniquely identifies each student. The full name and email are required using the NOT NULL constraint, while the UNIQUE constraint prevents two students from using the same email address.

### Courses Table

The `courses` table stores information about the courses offered by the school. It contains `course_id` as the primary key, `course_name`, and `description`. The course name is required, while the description is optional. Each course is stored once, even when many students enrol in it.

### Enrolments Table

The `enrolments` table records which student takes which course and the grade earned. It contains `enrolment_id` as its primary key, `student_id` as a foreign key referencing the students table, `course_id` as a foreign key referencing the courses table, and `grade`. The student and course IDs are required. The UNIQUE constraint on `(student_id, course_id)` prevents the same student from enrolling in the same course twice. The grade can be NULL until it is assigned.

## 2. Relationships

### Students and Enrolments: One-to-Many

One student can have multiple enrolment records because a student can take several courses. However, each enrolment record belongs to one student.

### Courses and Enrolments: One-to-Many

One course can have multiple enrolment records because several students can take the same course. However, each enrolment record refers to one course.

### Students and Courses: Many-to-Many

The relationship between students and courses is many-to-many. A student can take many courses, and each course can have many students. A join table called `enrolments` is needed to represent this relationship. It stores the student-course combinations and the grade earned for each combination. Without the join table, it would be difficult to represent multiple course enrolments for each student while maintaining a clear relational structure.

## 3. Recommended Index

I would create an index on `enrolments(course_id)` to improve queries that retrieve enrolments for a particular course and queries that group enrolments by course. The index helps SQLite locate relevant enrolment records more efficiently as the database grows. The UNIQUE constraint on `(student_id, course_id)` already creates an index for that combination, so creating another index on the same columns would be unnecessary.

## 4. SQL or NoSQL?

I would choose a relational SQL database such as SQLite for this school system. Students, courses, and enrolments have clearly defined structures and relationships. SQL supports JOIN operations, grouping, counting, and constraints that help maintain data integrity. Primary keys identify records, foreign keys connect related tables, and the UNIQUE constraint prevents duplicate enrolments. Grades also naturally belong to a particular student-course combination. SQLite is lightweight and suitable for a small school database, a learning project, or a prototype because it does not require a separate database server. If the application grows and requires many concurrent users, PostgreSQL could be considered. NoSQL databases can be useful for flexible, document-oriented data, but their flexibility is not necessary for this system's structured relationships.
