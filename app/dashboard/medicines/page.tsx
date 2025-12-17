'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

type Medicine = {
  id: number;
  category: string;
  title: string;
  tagline: string;
  description: string;
  image: string;
  url: string;
};

export default function MedicinesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Read category from URL params on mount and when params change
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    } else {
      setSelectedCategory('All');
    }
  }, [searchParams]);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    title: '',
    tagline: '',
    description: '',
    image: '',
    url: ''
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Sample medicine product data
  const medicines: Medicine[] = [
    {
      id: 1,
      category: 'Weight Loss',
      title: 'Metabolic Boost Pro',
      tagline: 'Accelerate Your Metabolism Naturally',
      description: 'Advanced formula designed to support healthy metabolism and energy levels. Contains natural ingredients that help boost your body\'s fat-burning capabilities.',
      image: '/images/medicine1.jpg',
      url: 'https://example.com/metabolic-boost-pro'
    },
    {
      id: 2,
      category: 'Digestive Health',
      title: 'Gut Balance Plus',
      tagline: 'Restore Your Digestive Harmony',
      description: 'Comprehensive digestive support supplement with probiotics and enzymes. Promotes healthy gut flora and improves nutrient absorption.',
      image: '/images/medicine2.jpg',
      url: 'https://example.com/gut-balance-plus'
    },
    {
      id: 3,
      category: 'Energy & Vitality',
      title: 'Energy Vitality Complex',
      tagline: 'Sustained Energy Throughout Your Day',
      description: 'Natural energy supplement that provides sustained vitality without crashes. Formulated with B-vitamins and adaptogenic herbs for optimal performance.',
      image: '/images/medicine3.jpg',
      url: 'https://example.com/energy-vitality-complex'
    },
    {
      id: 4,
      category: 'Weight Loss',
      title: 'Fat Burner Elite',
      tagline: 'Maximum Fat Burning Support',
      description: 'Premium thermogenic formula that enhances your body\'s natural fat-burning process. Ideal for active individuals seeking to optimize their weight loss journey.',
      image: '/images/medicine4.jpg',
      url: 'https://example.com/fat-burner-elite'
    },
    {
      id: 5,
      category: 'Immune Support',
      title: 'Immune Defense Shield',
      tagline: 'Strengthen Your Natural Defenses',
      description: 'Powerful immune system support with vitamin C, zinc, and elderberry. Helps maintain your body\'s natural defense mechanisms.',
      image: '/images/medicine5.jpg',
      url: 'https://example.com/immune-defense-shield'
    },
    {
      id: 6,
      category: 'Digestive Health',
      title: 'Digestive Enzyme Blend',
      tagline: 'Optimize Your Digestion',
      description: 'Complete enzyme formula that aids in breaking down proteins, fats, and carbohydrates. Supports comfortable digestion and nutrient utilization.',
      image: '/images/medicine6.jpg',
      url: 'https://example.com/digestive-enzyme-blend'
    },
  ];

  const [categories, setCategories] = useState<string[]>(['All', 'Weight Loss', 'Digestive Health', 'Energy & Vitality', 'Immune Support']);
  
  // Get unique categories from medicines and merge with existing categories
  const allCategories = ['All', ...Array.from(new Set([...categories.filter(c => c !== 'All'), ...medicines.map(m => m.category)]))];

  const filteredMedicines = medicines.filter(medicine => {
    const matchesSearch = medicine.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         medicine.tagline.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         medicine.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || medicine.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreate = () => {
    setEditingMedicine(null);
    setFormData({
      category: '',
      title: '',
      tagline: '',
      description: '',
      image: '',
      url: ''
    });
    setImagePreview(null);
    setNewCategoryName('');
    setIsModalOpen(true);
  };

  const handleEdit = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    setFormData({
      category: medicine.category,
      title: medicine.title,
      tagline: medicine.tagline,
      description: medicine.description,
      image: medicine.image,
      url: medicine.url
    });
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this medicine?')) {
      // TODO: Implement delete functionality
      console.log('Delete medicine:', id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category) {
      alert('Please select a category');
      return;
    }
    if (editingMedicine) {
      // TODO: Implement update functionality
      console.log('Update medicine:', editingMedicine.id, formData);
    } else {
      // TODO: Implement create functionality
      console.log('Create medicine:', formData);
    }
    setIsModalOpen(false);
    setEditingMedicine(null);
    setFormData({
      category: '',
      title: '',
      tagline: '',
      description: '',
      image: '',
      url: ''
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMedicine(null);
    setImagePreview(null);
    setFormData({
      category: '',
      title: '',
      tagline: '',
      description: '',
      image: '',
      url: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Medicine Products</h3>
          <p className="text-[#7895b3]">Manage and monitor all medicine products in the app</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => {
              const category = e.target.value;
              setSelectedCategory(category);
              // Update URL when category changes
              if (category === 'All') {
                router.push('/dashboard/medicines');
              } else {
                router.push(`/dashboard/medicines?category=${encodeURIComponent(category)}`);
              }
            }}
            className="px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] bg-white"
          >
            {allCategories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
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
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Medicine
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Total Products</p>
          <p className="text-2xl font-bold text-[#435970]">{medicines.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Categories</p>
          <p className="text-2xl font-bold text-[#435970]">{allCategories.length - 1}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Filtered Results</p>
          <p className="text-2xl font-bold text-[#435970]">{filteredMedicines.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Active Products</p>
          <p className="text-2xl font-bold text-[#435970]">{medicines.length}</p>
        </div>
      </div>

      {/* Medicines Table */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#dfedfb]">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-20">
                  Image
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-32">
                  Category
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-28">
                  Title
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-24">
                  Description
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-32">
                  URL
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfedfb]">
              {filteredMedicines.map((medicine) => (
                <tr key={medicine.id} className="hover:bg-[#dfedfb]/20 transition-colors">
                  <td className="px-3 py-3">
                    <div className="w-12 h-12 bg-[#dfedfb] rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                      <Image
                        src={medicine.image}
                        alt={medicine.title}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `
                              <svg class="w-6 h-6 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                            `;
                          }
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-1 text-xs font-medium bg-[#dfedfb] text-[#435970] rounded whitespace-nowrap">
                      {medicine.category}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm font-semibold text-[#435970] truncate" title={medicine.title}>
                      {medicine.title}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm text-[#435970] truncate max-w-[96px]" title={medicine.description}>
                      {medicine.description}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={medicine.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#7895b3] hover:text-[#435970] transition-colors flex items-center gap-1 truncate"
                      title={medicine.url}
                    >
                      <span className="truncate">{medicine.url}</span>
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(medicine)}
                        className="text-[#7895b3] hover:text-[#435970] transition-colors"
                        aria-label="Edit medicine"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(medicine.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        aria-label="Delete medicine"
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
            <span className="font-semibold text-[#435970]">{filteredMedicines.length}</span> of{' '}
            <span className="font-semibold text-[#435970]">{medicines.length}</span> products
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
      {filteredMedicines.length === 0 && (
        <div className="bg-white rounded-lg border border-[#dfedfb] p-12 text-center">
          <svg className="w-16 h-16 text-[#7895b3] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <p className="text-lg font-medium text-[#435970] mb-2">No products found</p>
          <p className="text-sm text-[#7895b3] mb-4">Try adjusting your search or filter criteria</p>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors"
          >
            Add First Medicine
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-[#435970]">
                {editingMedicine ? 'Edit Medicine' : 'Create New Medicine'}
              </h3>
              <button
                onClick={closeModal}
                className="text-[#7895b3] hover:text-[#435970] transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-[#435970] mb-2">
                    Category *
                  </label>
                  <select
                    id="category"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] bg-white"
                  >
                    <option value="">Select a category</option>
                    {allCategories.filter(c => c !== 'All').map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  {!formData.category && (
                    <p className="text-xs text-red-500 mt-1">Please select a category</p>
                  )}
                  {allCategories.filter(c => c !== 'All').length === 0 && (
                    <p className="text-xs text-[#7895b3] mt-1">
                      No categories available. <Link href="/dashboard/medicines/category" className="text-[#435970] hover:underline">Create one here</Link>.
                    </p>
                  )}
                </div>

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
                    placeholder="Enter product title"
                  />
                </div>
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
                  placeholder="Enter product tagline"
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
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3] resize-none"
                  placeholder="Enter product description"
                />
              </div>

              {/* Product Image Upload */}
              <div>
                <label htmlFor="image" className="block text-sm font-medium text-[#435970] mb-2">
                  Product Image *
                </label>
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  required={!editingMedicine}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const result = reader.result as string;
                        setImagePreview(result);
                        setFormData({ ...formData, image: result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#dfedfb] file:text-[#435970] hover:file:bg-[#7895b3] hover:file:text-white file:cursor-pointer"
                />
                {(imagePreview || (editingMedicine && formData.image)) && (
                  <div className="mt-2 w-32 h-32 bg-[#dfedfb] rounded-lg overflow-hidden">
                    <Image
                      src={imagePreview || formData.image}
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

              {/* Product URL */}
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-[#435970] mb-2">
                  Product URL *
                </label>
                <input
                  type="url"
                  id="url"
                  required
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                  placeholder="https://example.com/product"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2 border border-[#dfedfb] text-[#435970] rounded-lg font-medium hover:bg-[#dfedfb] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors"
                >
                  {editingMedicine ? 'Update Medicine' : 'Create Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

