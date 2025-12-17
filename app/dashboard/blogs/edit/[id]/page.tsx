'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const blogId = params?.id as string;

  // Sample blog data - in real app, fetch from API
  const sampleBlogs: Blog[] = [
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

  const [formData, setFormData] = useState({
    title: '',
    tagline: '',
    description: '',
    tag: '',
    featuredImage: ''
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [tags, setTags] = useState<string[]>(['Weight Loss', 'Nutrition', 'Fitness', 'Wellness', 'Health Tips']);

  useEffect(() => {
    // In real app, fetch blog by ID from API
    const blog = sampleBlogs.find(b => b.id === parseInt(blogId || '0'));
    if (blog) {
      setFormData({
        title: blog.title,
        tagline: blog.tagline,
        description: blog.description,
        tag: blog.tag,
        featuredImage: blog.featuredImage
      });
    }
  }, [blogId]);

  const handleAddTag = () => {
    if (newTagName.trim() && !tags.includes(newTagName.trim())) {
      setTags([...tags, newTagName.trim()]);
      setFormData({ ...formData, tag: newTagName.trim() });
      setNewTagName('');
    }
  };

  const handleDeleteTag = (tagToDelete: string) => {
    if (confirm(`Are you sure you want to delete the tag "${tagToDelete}"?`)) {
      setTags(tags.filter(t => t !== tagToDelete));
      if (formData.tag === tagToDelete) {
        setFormData({ ...formData, tag: '' });
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.tagline || !formData.description || !formData.tag || !formData.featuredImage) {
      alert('Please fill in all required fields');
      return;
    }
    // TODO: Implement update functionality
    console.log('Update blog:', blogId, formData);
    router.push('/dashboard/blogs');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Edit Blog</h3>
          <p className="text-[#7895b3]">Update blog post information</p>
        </div>
        <Link
          href="/dashboard/blogs"
          className="px-4 py-2 border border-[#dfedfb] text-[#435970] rounded-lg font-medium hover:bg-[#dfedfb] transition-colors"
        >
          Cancel
        </Link>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-[#dfedfb] p-6 space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-[#435970] mb-2">
            Title *
          </label>
          <input
            type="text"
            id="title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
            placeholder="Enter blog title"
          />
        </div>

        {/* Tagline */}
        <div>
          <label htmlFor="tagline" className="block text-sm font-medium text-[#435970] mb-2">
            Tagline *
          </label>
          <input
            type="text"
            id="tagline"
            required
            value={formData.tagline}
            onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
            className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
            placeholder="Enter blog tagline"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-[#435970] mb-2">
            Description *
          </label>
          <textarea
            id="description"
            required
            rows={6}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3] resize-none"
            placeholder="Enter blog description"
          />
        </div>

        {/* Tag */}
        <div>
          <label className="block text-sm font-medium text-[#435970] mb-2">
            Tag *
          </label>
          
          {/* Tag Tags */}
          <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] p-2 border border-[#dfedfb] rounded-lg bg-gray-50">
            {tags.map(tag => (
              <div
                key={tag}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  formData.tag === tag
                    ? 'bg-[#435970] text-white'
                    : 'bg-[#dfedfb] text-[#435970] hover:bg-[#7895b3] hover:text-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tag })}
                  className="flex items-center gap-1"
                >
                  {tag}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTag(tag);
                  }}
                  className={`hover:opacity-80 transition-opacity ${
                    formData.tag === tag ? 'text-white' : 'text-[#435970]'
                  }`}
                  title="Delete tag"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {tags.length === 0 && (
              <span className="text-sm text-[#7895b3]">No tags yet. Add one below.</span>
            )}
          </div>

          {/* Add New Tag Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Type to add new tag..."
              className="flex-1 px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!newTagName.trim()}
              className="px-4 py-2 bg-[#435970] text-white rounded-lg hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>
          
          {!formData.tag && (
            <p className="text-xs text-red-500 mt-1">Please select a tag</p>
          )}
        </div>

        {/* Featured Image Upload */}
        <div>
          <label htmlFor="featuredImage" className="block text-sm font-medium text-[#435970] mb-2">
            Featured Image *
          </label>
          <input
            type="file"
            id="featuredImage"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const result = reader.result as string;
                  setImagePreview(result);
                  setFormData({ ...formData, featuredImage: result });
                };
                reader.readAsDataURL(file);
              }
            }}
            className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#dfedfb] file:text-[#435970] hover:file:bg-[#7895b3] hover:file:text-white file:cursor-pointer"
          />
          {(imagePreview || formData.featuredImage) && (
            <div className="mt-2 w-32 h-32 bg-[#dfedfb] rounded-lg overflow-hidden">
              <Image
                src={imagePreview || formData.featuredImage}
                alt="Preview"
                width={128}
                height={128}
                className="object-cover w-full h-full"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link
            href="/dashboard/blogs"
            className="px-6 py-2 border border-[#dfedfb] text-[#435970] rounded-lg font-medium hover:bg-[#dfedfb] transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-6 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors"
          >
            Update Blog
          </button>
        </div>
      </form>
    </div>
  );
}

