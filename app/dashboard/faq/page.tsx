'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import ConfirmModal from '@/app/components/ConfirmModal';
import NotificationModal from '@/app/components/NotificationModal';

type FAQ = {
  id: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function FAQPage() {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [faqToDelete, setFaqToDelete] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  
  // Form state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    order: 0,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch FAQs from API
  const fetchFAQs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const response = await fetch(`/api/faqs?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch FAQs');
      }
      
      const data = await response.json();
      setFaqs(data.faqs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching FAQs:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchFAQs();
  }, [fetchFAQs]);

  const handleAddClick = () => {
    setFormData({
      question: '',
      answer: '',
      order: 0,
      isActive: true,
    });
    setIsAddModalOpen(true);
  };

  const handleEditClick = (faq: FAQ) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      order: faq.order,
      isActive: faq.isActive,
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setFaqToDelete(id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!faqToDelete) return;

    try {
      setDeletingId(faqToDelete);
      setShowDeleteModal(false);
      const response = await fetch(`/api/faqs/${faqToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete FAQ');
      }

      // Refresh FAQs list
      await fetchFAQs();
      setNotification({
        title: 'Success',
        message: 'FAQ deleted successfully',
        type: 'success',
      });
      setShowNotification(true);
    } catch (err) {
      setNotification({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to delete FAQ',
        type: 'error',
      });
      setShowNotification(true);
    } finally {
      setDeletingId(null);
      setFaqToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingFaq ? `/api/faqs/${editingFaq.id}` : '/api/faqs';
      const method = editingFaq ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save FAQ');
      }

      // Refresh FAQs list
      await fetchFAQs();
      
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      setEditingFaq(null);
      setFormData({
        question: '',
        answer: '',
        order: 0,
        isActive: true,
      });

      setNotification({
        title: 'Success',
        message: editingFaq ? 'FAQ updated successfully' : 'FAQ created successfully',
        type: 'success',
      });
      setShowNotification(true);
    } catch (err) {
      setNotification({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save FAQ',
        type: 'error',
      });
      setShowNotification(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleActive = async (faq: FAQ) => {
    try {
      const response = await fetch(`/api/faqs/${faq.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          question: faq.question,
          answer: faq.answer,
          order: faq.order,
          isActive: !faq.isActive,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update FAQ status');
      }

      await fetchFAQs();
      setNotification({
        title: 'Success',
        message: `FAQ ${!faq.isActive ? 'activated' : 'deactivated'} successfully`,
        type: 'success',
      });
      setShowNotification(true);
    } catch (err) {
      setNotification({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update FAQ status',
        type: 'error',
      });
      setShowNotification(true);
    }
  };

  if (loading && faqs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#435970]"></div>
          <p className="mt-4 text-[#7895b3]">Loading FAQs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">FAQ Management</h3>
          <p className="text-[#7895b3]">Manage frequently asked questions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search FAQs..."
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
            onClick={handleAddClick}
            className="px-4 py-2 bg-[#435970] text-white rounded-lg hover:bg-[#7895b3] transition-colors font-medium"
          >
            + Add FAQ
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Total FAQs</p>
          <p className="text-2xl font-bold text-[#435970]">{faqs.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Active FAQs</p>
          <p className="text-2xl font-bold text-[#435970]">
            {faqs.filter(f => f.isActive).length}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Inactive FAQs</p>
          <p className="text-2xl font-bold text-[#435970]">
            {faqs.filter(f => !f.isActive).length}
          </p>
        </div>
      </div>

      {/* FAQs Table */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#dfedfb]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Question
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Answer
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfedfb]">
              {faqs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#7895b3]">
                    {loading ? 'Loading...' : 'No FAQs found'}
                  </td>
                </tr>
              ) : (
                faqs.map((faq) => (
                  <tr key={faq.id} className="hover:bg-[#dfedfb]/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-[#435970]">{faq.order}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-[#435970] max-w-md">
                        {faq.question}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#7895b3] max-w-md line-clamp-2">
                        {faq.answer}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => toggleActive(faq)}
                        className={`inline-flex px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          faq.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {faq.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#7895b3]">
                      {new Date(faq.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditClick(faq)}
                          className="text-[#7895b3] hover:text-[#435970] transition-colors"
                          aria-label="Edit FAQ"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(faq.id)}
                          disabled={deletingId === faq.id}
                          className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Delete FAQ"
                        >
                          {deletingId === faq.id ? (
                            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add FAQ Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setIsAddModalOpen(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-[#435970]">Add New FAQ</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#7895b3] hover:text-[#435970] transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="question" className="block text-sm font-medium text-[#435970] mb-2">
                  Question <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="question"
                  value={formData.question}
                  onChange={(e) => handleInputChange('question', e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
                  placeholder="Enter FAQ question"
                />
              </div>

              <div>
                <label htmlFor="answer" className="block text-sm font-medium text-[#435970] mb-2">
                  Answer <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="answer"
                  value={formData.answer}
                  onChange={(e) => handleInputChange('answer', e.target.value)}
                  required
                  rows={6}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] resize-none"
                  placeholder="Enter FAQ answer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="order" className="block text-sm font-medium text-[#435970] mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    id="order"
                    value={formData.order}
                    onChange={(e) => handleInputChange('order', parseInt(e.target.value) || 0)}
                    min="0"
                    className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
                  />
                </div>

                <div className="flex items-center pt-8">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => handleInputChange('isActive', e.target.checked)}
                      className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3]"
                    />
                    <span className="ml-2 text-sm text-[#435970]">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-6 py-2 border border-[#dfedfb] text-[#435970] rounded-lg hover:bg-[#dfedfb] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-[#435970] text-white rounded-lg hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create FAQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit FAQ Modal */}
      {isEditModalOpen && editingFaq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setIsEditModalOpen(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-[#435970]">Edit FAQ</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-[#7895b3] hover:text-[#435970] transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="edit-question" className="block text-sm font-medium text-[#435970] mb-2">
                  Question <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="edit-question"
                  value={formData.question}
                  onChange={(e) => handleInputChange('question', e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
                  placeholder="Enter FAQ question"
                />
              </div>

              <div>
                <label htmlFor="edit-answer" className="block text-sm font-medium text-[#435970] mb-2">
                  Answer <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="edit-answer"
                  value={formData.answer}
                  onChange={(e) => handleInputChange('answer', e.target.value)}
                  required
                  rows={6}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] resize-none"
                  placeholder="Enter FAQ answer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-order" className="block text-sm font-medium text-[#435970] mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    id="edit-order"
                    value={formData.order}
                    onChange={(e) => handleInputChange('order', parseInt(e.target.value) || 0)}
                    min="0"
                    className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
                  />
                </div>

                <div className="flex items-center pt-8">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => handleInputChange('isActive', e.target.checked)}
                      className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3]"
                    />
                    <span className="ml-2 text-sm text-[#435970]">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-6 py-2 border border-[#dfedfb] text-[#435970] rounded-lg hover:bg-[#dfedfb] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-[#435970] text-white rounded-lg hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Updating...' : 'Update FAQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setFaqToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete FAQ"
        message="Are you sure you want to delete this FAQ? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* Notification Modal */}
      <NotificationModal
        isOpen={showNotification}
        onClose={() => setShowNotification(false)}
        title={notification?.title || ''}
        message={notification?.message || ''}
        type={notification?.type || 'info'}
      />
    </div>
  );
}

