import React from 'react';
import { Customer } from '../types';
import { AlertCircle } from 'lucide-react';

const PALESTINE_CITIES = [
    'غير محدد',
    'القدس',
    'رام الله والبيرة',
    'الخليل',
    'نابلس',
    'جنين',
    'طولكرم',
    'قلقيلية',
    'بيت لحم',
    'أريحا',
    'سلفيت',
    'طوباس'
];

interface CustomerFormProps {
    formData: Partial<Customer>;
    setFormData: React.Dispatch<React.SetStateAction<Partial<Customer>>>;
    errors: { [key: string]: string };
    setErrors: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
    availableTypes: string[];
    editingId: string | null;
    nextSerial: number;
    onSave: () => void;
    onClose: () => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
    formData,
    setFormData,
    errors,
    setErrors,
    availableTypes,
    editingId,
    nextSerial,
    onSave,
    onClose,
}) => {
    const handleWhatsappChange = (val: string) => {
        val = val.replace(/[^0-9+]/g, '');
        if (!val.startsWith('+')) {
            val = '+' + val.replace(/^\+/, '');
        }
        val = val.replace('+00', '+');
        setFormData({ ...formData, whatsapp: val });
        if (errors.whatsapp) setErrors({ ...errors, whatsapp: '' });
    };

    const handlePhoneChange = (val: string) => {
        val = val.replace(/[^0-9]/g, '');
        setFormData({ ...formData, phone: val });
        if (errors.phone) setErrors({ ...errors, phone: '' });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">{editingId ? 'تعديل بيانات زبون' : `إضافة زبون جديد (#${nextSerial})`}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Basic Info */}
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">اسم الزبون (اجباري)</label>
                        <input
                            type="text"
                            className={`w-full p-2 border rounded-lg ${errors.name ? 'border-red-500 bg-red-50' : ''}`}
                            value={formData.name || ''}
                            onChange={e => {
                                setFormData({ ...formData, name: e.target.value });
                                if (errors.name) setErrors({ ...errors, name: '' });
                            }}
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.name}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">تصنيف الزبون</label>
                        <div className="flex gap-2">
                            <select
                                className="w-full p-2 border rounded-lg"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="غير مصنف">غير مصنف</option>
                                {availableTypes.filter(t => t !== 'غير مصنف').map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Location */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">المدينة</label>
                        <select
                            className="w-full p-2 border rounded-lg"
                            value={formData.city || ''}
                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                        >
                            {PALESTINE_CITIES.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">القرية / المنطقة</label>
                        <input type="text" className="w-full p-2 border rounded-lg" value={formData.village || ''} onChange={e => setFormData({ ...formData, village: e.target.value })} placeholder="مثال: الطيرة" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الحي / الشارع</label>
                        <input type="text" className="w-full p-2 border rounded-lg" value={formData.neighborhood || ''} onChange={e => setFormData({ ...formData, neighborhood: e.target.value })} />
                    </div>

                    {/* Contact */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم الجوال (اختياري)</label>
                        <input
                            type="text"
                            dir="ltr"
                            className={`w-full p-2 border rounded-lg text-lg ${errors.phone ? 'border-red-500 bg-red-50' : ''}`}
                            value={formData.phone || ''}
                            maxLength={10}
                            placeholder="05xxxxxxxx"
                            onChange={e => handlePhoneChange(e.target.value)}
                        />
                        {errors.phone ? (
                            <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.phone}</p>
                        ) : (
                            <p className="text-xs text-gray-400 mt-1">إذا أدخلت رقماً، يجب أن يكون 10 خانات</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم الواتساب (اختياري)</label>
                        <input
                            type="text"
                            dir="ltr"
                            className={`w-full p-2 border rounded-lg text-lg ${errors.whatsapp ? 'border-red-500 bg-red-50' : 'text-green-800'}`}
                            value={formData.whatsapp || '+'}
                            onChange={e => handleWhatsappChange(e.target.value)}
                            placeholder="+972..."
                        />
                        {errors.whatsapp && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.whatsapp}</p>}
                    </div>

                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onSave}
                        className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
                    >
                        حفظ البيانات
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    );
};
