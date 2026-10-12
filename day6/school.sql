
-- =====================================================
-- DAY 6 ASSIGNMENT: SCHOOL DATABASE
-- Database: SQLite
-- =====================================================

-- Enable foreign-key enforcement for this connection.
-- This must execute before database operations begin.
PRAGMA foreign_keys = ON;


-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- Students table: stores student details.
CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);


-- Courses table: stores available courses.
CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY,
    course_name TEXT NOT NULL,
    description TEXT
);


-- Enrolments table: connects students and courses.
-- Each enrolment can have its own grade.
CREATE TABLE enrolments (
    enrolment_id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,

    FOREIGN KEY (student_id)
        REFERENCES students(student_id),

    FOREIGN KEY (course_id)
        REFERENCES courses(course_id),

    -- Prevent the same student enrolling in the
    -- same course more than once.
    UNIQUE (student_id, course_id)
);


-- =====================================================
-- 2. INSERT SAMPLE STUDENTS
-- =====================================================

INSERT INTO students (student_id, full_name, email)
VALUES
    (1, 'Alice Wanjiku', 'alice@example.com'),
    (2, 'Brian Otieno', 'brian@example.com'),
    (3, 'Carol Achieng', 'carol@example.com'),
    (4, 'David Mwangi', 'david@example.com');


-- =====================================================
-- 3. INSERT SAMPLE COURSES
-- =====================================================

INSERT INTO courses (course_id, course_name, description)
VALUES
    (1, 'Database Systems',
        'Database design and SQL'),
    (2, 'Web Development',
        'HTML, CSS and JavaScript'),
    (3, 'Computer Networks',
        'Networking principles');


-- =====================================================
-- 4. INSERT SAMPLE ENROLMENTS
-- =====================================================

INSERT INTO enrolments
    (enrolment_id, student_id, course_id, grade)
VALUES
    (1, 1, 1, 'A'),
    (2, 1, 2, 'B'),
    (3, 2, 1, 'B'),
    (4, 2, 3, 'A'),
    (5, 3, 2, 'A');


-- =====================================================
-- QUERY 1: ALL COURSES FOR ONE STUDENT
-- =====================================================
-- Find courses taken by Alice Wanjiku.

SELECT
    s.full_name,
    c.course_name,
    e.grade
FROM students AS s
JOIN enrolments AS e
    ON s.student_id = e.student_id
JOIN courses AS c
    ON e.course_id = c.course_id
WHERE s.full_name = 'Alice Wanjiku';


-- =====================================================
-- QUERY 2: ALL STUDENTS ON ONE COURSE
-- =====================================================
-- Find students enrolled in Database Systems.

SELECT
    c.course_name,
    s.full_name,
    e.grade
FROM courses AS c
JOIN enrolments AS e
    ON c.course_id = e.course_id
JOIN students AS s
    ON e.student_id = s.student_id
WHERE c.course_name = 'Database Systems';


-- =====================================================
-- QUERY 3: NUMBER OF STUDENTS PER COURSE
-- =====================================================
-- LEFT JOIN includes courses with zero enrolments.
-- COUNT(e.student_id) returns zero for such courses.

SELECT
    c.course_name,
    COUNT(e.student_id) AS number_of_students
FROM courses AS c
LEFT JOIN enrolments AS e
    ON c.course_id = e.course_id
GROUP BY
    c.course_id,
    c.course_name
ORDER BY c.course_id;



-- =====================================================
-- QUERY 4: STUDENTS WITH NO ENROLMENTS
-- =====================================================
-- LEFT JOIN retains all students.
-- NULL identifies students with no matching enrolment.

SELECT
    s.student_id,
    s.full_name,
    s.email
FROM students AS s
LEFT JOIN enrolments AS e
    ON s.student_id = e.student_id
WHERE e.student_id IS NULL;


-- =====================================================
-- QUERY 5: UPDATE AN ENROLMENT'S GRADE
-- =====================================================
-- Change Brian Otieno's Database Systems grade
-- from B to A.

UPDATE enrolments
SET grade = 'A'
WHERE student_id = 2
  AND course_id = 1;


-- Verify the updated grade.

SELECT
    s.full_name,
    c.course_name,
    e.grade
FROM enrolments AS e
JOIN students AS s
    ON e.student_id = s.student_id
JOIN courses AS c
    ON e.course_id = c.course_id
WHERE e.student_id = 2
  AND e.course_id = 1;


-- =====================================================
-- 5. CREATE AN INDEX
-- =====================================================
-- Improves course-based enrolment lookups and
-- course-level aggregations.

CREATE INDEX idx_enrolments_course_id
ON enrolments(course_id);
