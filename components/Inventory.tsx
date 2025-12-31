

import React, { useState } from 'react';
import { Product } from '../types';
import { Plus, Cylinder, Trash2, Snowflake, AlertCircle } from 'lucide-react';

interface InventoryProps {
  products: Product[];
  onUpdate: (products: Product[]) => void;
}

export const Inventory: React.FC<InventoryProps> = ({ products, onUpdate }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [errors, setErrors] = useState<{name?: string}>({});

  const handleSave = () => {
    // Validation
    const newErrors: {name?: string} = {};
    if (!formData.name) newErrors.name = 'اسم النوع مطلوب';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingId) {
      onUpdate(products.map(p => p.id === editingId ? { ...p, ...formData } as Product : p));
    } else {
      const newProduct: Product = {
        id: Date.now().toString(),
        name: formData.name!,
        size: formData.size || 'عام',
        stock: 0, 
        minStock: 0, 
        isActive: true,
      };
      onUpdate([...products, newProduct]);
    }
    setShowModal(false);
    setEditingId(null);
    setFormData({});
    setErrors({});
  };

  const handleDelete = () => {
    if (editingId && window.confirm('هل أنت متأكد من حذف هذا النوع نهائياً؟')) {
      onUpdate(products.filter(p => p.id !== editingId));
      setShowModal(false);
      setEditingId(null);
    }
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData(product);
    setErrors({});
    setShowModal(true);
  };

  const openAdd = () => {
    setEditingId(null);
    setFormData({ isActive: true });
    setErrors({});
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">أنواع الغاز (للمبيعات)</h2>
        <button 
          onClick={openAdd}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <Plus size={20} />
          <span>إضافة نوع جديد</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-600 text-lg">
              <tr>
                <th className="p-5">نوع الأسطوانة</th>
                <th className="p-5">الحجم / الوزن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map(product => (
                <tr 
                  key={product.id} 
                  onClick={() => openEdit(product)}
                  className={`hover:bg-gray-50 transition cursor-pointer ${!product.isActive ? 'opacity-50 bg-gray-50' : ''}`}
                >
                  <td className="p-5 font-bold text-lg text-gray-800 flex items-center gap-3">
                    <Cylinder size={24} className={product.isActive ? "text-primary-500" : "text-gray-400"} />
                    {product.name}
                    {!product.isActive && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">مجمد</span>}
                  </td>
                  <td className="p-5 text-gray-600 text-lg">{product.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <h3 className="text-xl font-bold mb-4">{editingId ? 'تحرير بيانات النوع' : 'إضافة نوع جديد'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم النوع</label>
                <input 
                  type="text" 
                  className={`w-full p-3 border rounded-lg text-lg ${errors.name ? 'border-red-500 bg-red-50' : ''}`}
                  value={formData.name || ''}
                  onChange={e => {
                    setFormData({...formData, name: e.target.value});
                    if (errors.name) setErrors({...errors, name: ''});
                  }}
                  placeholder="مثال: اسطوانة منزلية، نصف اسطوانة"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12}/> {errors.name}</p>}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">الحجم</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg text-lg"
                  value={formData.size || ''}
                  onChange={e => setFormData({...formData, size: e.target.value})}
                  placeholder="مثال: 12 كغم، 6 كغم"
                />
              </div>
              
              <div className="col-span-2 mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 text-primary-600 rounded"
                    checked={formData.isActive ?? true}
                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                  />
                  <span className="text-gray-800 font-medium">نوع نشط (متاح للبيع)</span>
                </label>
                {!formData.isActive && <span className="text-xs text-orange-600 font-bold"><Snowflake size={14} className="inline ml-1"/>مجمد</span>}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-bold">حفظ التغييرات</button>
              <button onClick={() => setShowModal(false)} className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200">إلغاء</button>
              {editingId && (
                <button onClick={handleDelete} className="bg-red-50 text-red-600 px-4 py-3 rounded-lg hover:bg-red-100" title="حذف نهائي">
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};