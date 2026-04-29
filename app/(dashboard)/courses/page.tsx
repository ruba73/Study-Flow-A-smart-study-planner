'use client';

import { useState, useEffect } from 'react';
import { CourseCard } from '@/components/courses/CourseCard';
import { CourseModal } from '@/components/courses/CourseModal';

export interface Course {
  id: string;
  name: string;
  color: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  progress: number;
  deadline: string;
  hoursPerWeek: number;
  goals: string[];
}
export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ ADD IT HERE
  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch('/api/courses');
        const data = await res.json();

        console.log('API response:', data);

        if (Array.isArray(data)) {
          setCourses(data);
        } else if (Array.isArray(data.courses)) {
          setCourses(data.courses);
        } else {
          setCourses([]);
        }

      } catch (err) {
        console.error('Failed to fetch courses:', err);
        setCourses([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCourses();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // ✅ Fetch courses from API
  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        setCourses(data);
      } catch (err) {
        console.error('Failed to fetch courses:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCourses();
  }, []);

  // ✅ Create / Update
  const handleSave = async (courseData: Omit<Course, 'id'> | Course) => {
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseData),
      });

      const savedCourse = await res.json();

      if ('id' in courseData) {
        setCourses(courses.map(c => c.id === savedCourse.id ? savedCourse : c));
      } else {
        setCourses([...courses, savedCourse]);
      }

      setIsModalOpen(false);
      setEditingCourse(null);
    } catch (err) {
      console.error('Failed to save course:', err);
    }
  };

  // ✅ Delete
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this course?')) return;

    try {
      await fetch(`/api/courses/${id}`, {
        method: 'DELETE',
      });

      setCourses(courses.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete course:', err);
    }
  };

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingCourse(null);
    setIsModalOpen(true);
  };

  // ✅ Loading state
  if (loading) {
    return <p className="p-6 text-gray-600">Loading courses...</p>;
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-4">

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-gray-600 hidden md:block">
            Manage your courses and learning goals
          </p>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg text-sm font-medium"
          >
            <span className="text-lg">+</span>
            Add Course
          </button>
        </div>

        {/* Empty state */}
        {courses.length === 0 ? (
          <p className="text-gray-500 text-center mt-10">
            No courses yet. Start by adding one 🚀
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onEdit={() => openEditModal(course)}
                onDelete={() => handleDelete(course.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <CourseModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCourse(null);
        }}
        onSave={handleSave}
        course={editingCourse}
      />
    </div>
  );
}
