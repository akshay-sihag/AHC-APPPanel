'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Blog = {
  id: number;
  title: string;
  tagline: string;
  description: string;
  tag: string;
  featuredImage: string;
  createdAt: string;
};

export default function BlogsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Sample blog data
  const blogs: Blog[] = [
    {
      id: 1,
      title: '10 Essential Tips for Healthy Weight Loss',
      tagline: 'Discover proven strategies to achieve your weight loss goals naturally',
      description: 'Weight loss is a journey that requires dedication, patience, and the right approach. In this comprehensive guide, we explore ten essential tips that can help you achieve your weight loss goals in a healthy and sustainable way. From nutrition advice to exercise routines, learn how to create a balanced lifestyle that supports your wellness journey.',
      tag: 'Weight Loss',
      featuredImage: '/images/blog1.jpg',
      createdAt: '2024-01-15'
    },
    {
      id: 2,
      title: 'The Science Behind Intermittent Fasting',
      tagline: 'Understanding how intermittent fasting can transform your health',
      description: 'Intermittent fasting has gained significant attention in recent years as a powerful tool for improving health and managing weight. This article delves into the scientific research behind intermittent fasting, exploring its benefits for metabolism, cellular repair, and overall well-being. Discover different fasting methods and learn how to safely incorporate this practice into your lifestyle.',
      tag: 'Nutrition',
      featuredImage: '/images/blog2.jpg',
      createdAt: '2024-01-20'
    },
    {
      id: 3,
      title: 'Building a Sustainable Exercise Routine',
      tagline: 'Create a workout plan that fits your lifestyle and goals',
      description: 'Creating a sustainable exercise routine is key to long-term fitness success. This guide provides practical advice on designing a workout plan that aligns with your lifestyle, fitness level, and personal goals. Learn about different types of exercises, how to structure your weekly routine, and tips for staying motivated and consistent.',
      tag: 'Fitness',
      featuredImage: '/images/blog3.jpg',
      createdAt: '2024-01-25'
    },
    {
      id: 4,
      title: 'Mental Health and Wellness: A Holistic Approach',
      tagline: 'Exploring the connection between mind and body wellness',
      description: 'Mental health and physical wellness are deeply interconnected. This article explores the holistic approach to health, examining how our mental state affects our physical well-being and vice versa. Learn about stress management techniques, mindfulness practices, and strategies for maintaining emotional balance in your daily life.',
      tag: 'Wellness',
      featuredImage: '/images/blog4.jpg',
      createdAt: '2024-02-01'
    },
  ];

  const [tags, setTags] = useState<string[]>(['Weight Loss', 'Nutrition', 'Fitness', 'Wellness', 'Health Tips']);

  const allTags = Array.from(new Set([...tags, ...blogs.map(b => b.tag)]));

  const filteredBlogs = blogs.filter(blog => {
    const matchesSearch = blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         blog.tagline.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         blog.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         blog.tag.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this blog?')) {
      // TODO: Implement delete functionality
      console.log('Delete blog:', id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Blog Posts</h3>
          <p className="text-[#7895b3]">Manage and monitor all blog posts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search blogs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 pl-10 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7895b3]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <Link
            href="/dashboard/blogs/add"
            className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Blog
          </Link>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Total Blogs</p>
          <p className="text-2xl font-bold text-[#435970]">{blogs.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Tags</p>
          <p className="text-2xl font-bold text-[#435970]">{allTags.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Filtered Results</p>
          <p className="text-2xl font-bold text-[#435970]">{filteredBlogs.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Published</p>
          <p className="text-2xl font-bold text-[#435970]">{blogs.length}</p>
        </div>
      </div>

      {/* Blogs Table */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#dfedfb]">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-20">
                  Image
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-32">
                  Title
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-28">
                  Tagline
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-24">
                  Description
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-24">
                  Tag
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-24">
                  Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfedfb]">
              {filteredBlogs.map((blog) => (
                <tr key={blog.id} className="hover:bg-[#dfedfb]/20 transition-colors">
                  <td className="px-3 py-3">
                    <div className="w-12 h-12 bg-[#dfedfb] rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                      <Image
                        src={blog.featuredImage}
                        alt={blog.title}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `
                              <svg class="w-6 h-6 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                              </svg>
                            `;
                          }
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm font-semibold text-[#435970] truncate" title={blog.title}>
                      {blog.title}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm text-[#435970] truncate max-w-[112px]" title={blog.tagline}>
                      {blog.tagline}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm text-[#435970] truncate max-w-[96px]" title={blog.description}>
                      {blog.description}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-1 text-xs font-medium bg-[#dfedfb] text-[#435970] rounded whitespace-nowrap">
                      {blog.tag}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm text-[#7895b3]">
                      {new Date(blog.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/blogs/edit/${blog.id}`}
                        className="text-[#7895b3] hover:text-[#435970] transition-colors"
                        aria-label="Edit blog"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => handleDelete(blog.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        aria-label="Delete blog"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-[#dfedfb] flex items-center justify-between">
          <div className="text-sm text-[#7895b3]">
            Showing <span className="font-semibold text-[#435970]">1</span> to{' '}
            <span className="font-semibold text-[#435970]">{filteredBlogs.length}</span> of{' '}
            <span className="font-semibold text-[#435970]">{blogs.length}</span> blogs
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors">
              Previous
            </button>
            <button className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredBlogs.length === 0 && (
        <div className="bg-white rounded-lg border border-[#dfedfb] p-12 text-center">
          <svg className="w-16 h-16 text-[#7895b3] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <p className="text-lg font-medium text-[#435970] mb-2">No blogs found</p>
          <p className="text-sm text-[#7895b3] mb-4">Try adjusting your search criteria</p>
          <Link
            href="/dashboard/blogs/add"
            className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors inline-block"
          >
            Add First Blog
          </Link>
        </div>
      )}
    </div>
  );
}

