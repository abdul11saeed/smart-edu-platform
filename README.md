# منصة التعليم الذكية للجامعات اليمنية

منصة شاملة لإدارة ومشاركة المقررات الجامعية مع أدوات الذكاء الاصطناعي.

## 🚀 الميزات

- **هيكل هرمي**: جامعة ← كلية ← تخصص ← مقرر
- **أدوات الذكاء الاصطناعي**:
  - تلخيص الملفات
  - شرح المفاهيم المعقدة
  - توليد الأسئلة التدريبية
- **واجهة متجاوبة**: تعمل على جميع الأجهزة
- **إدارة شاملة**: للطلاب والمشرفين

## 🛠️ التثبيت والتشغيل

```bash
npm install
npm run dev
```

## 🤖 تكامل نموذج الذكاء الاصطناعي

### 1. تحديث خدمة الذكاء الاصطناعي

قم بتحديث الملف `src/utils/aiService.ts` لتكامل نموذجك المدرب:

```typescript
// بدلاً من البيانات الوهمية:
const response = await fetch('YOUR_MODEL_API_ENDPOINT', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request)
});
return response.json();
```

### 2. APIs المطلوبة

#### تلخيص الملفات
```typescript
POST /api/summarize
{
  "text": "محتوى الملف",
  "fileName": "اسم الملف"
}
```

#### شرح المفاهيم
```typescript
POST /api/explain
{
  "concept": "المفهوم المراد شرحه",
  "context": "السياق"
}
```

#### توليد الأسئلة
```typescript
POST /api/generate-questions
{
  "text": "محتوى الملف",
  "questionType": "multiple-choice",
  "numQuestions": 5
}
```

### 3. تنسيقات الاستجابة

#### استجابة التلخيص:
```json
{
  "summary": "الملخص الرئيسي",
  "keyPoints": ["نقطة 1", "نقطة 2"]
}
```

#### استجابة الشرح:
```json
{
  "explanation": "الشرح التفصيلي",
  "simpleExplanation": "الشرح البسيط",
  "examples": ["مثال 1", "مثال 2"]
}
```

#### استجابة الأسئلة:
```json
{
  "questions": [
    {
      "id": "1",
      "question": "السؤال",
      "type": "multiple-choice",
      "options": ["خيار 1", "خيار 2"],
      "answer": "الإجابة الصحيحة"
    }
  ]
}
```

## 📁 هيكل المشروع

```
src/
├── components/
│   ├── ai/          # مكونات الذكاء الاصطناعي
│   ├── layout/      # مكونات التخطيط
│   ├── navigation/  # مكونات التنقل
│   └── ui/          # مكونات واجهة المستخدم
├── pages/           # صفحات التطبيق
├── stores/          # إدارة الحالة
├── types/           # تعريفات TypeScript
└── utils/           # الأدوات المساعدة
```

## 🎨 التصميم

- **الألوان**: أزرق داكن (#1e40af), أزرق فاتح (#14b8a6), أخضر (#10b981)
- **الخط**: Inter
- **متجاوب**: Tailwind CSS

## 🔧 التقنيات المستخدمة

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand
- Lucide Icons

## 📞 الدعم

لأي استفسارات حول تكامل نموذج الذكاء الاصطناعي، يرجى مراجعة ملف `aiService.ts` وتحديث endpoints النموذج الخاص بك.

---

## ⚙️ إعدادات Firebase Storage (مهم جداً لرفع الملفات)

لم解决 مشكلة CORS عند رفع الملفات، تحتاج إلى نشر إعدادات CORS على Firebase Storage. اتبع الخطوات التالية:

### المتطلبات

1. تثبيت Firebase CLI:
```bash
npm install -g firebase-tools
```

2. تسجيل الدخول إلى Firebase:
```bash
firebase login
```

### نشر إعدادات CORS

قم بتشغيل الأمر التالي في مجلد المشروع:

```bash
firebase init
```

ثم اختر:
- Firebase Storage: ℹ️
- Use an existing project: eduaiplatform-39fe9

بعد التهيئة، قم بتشغيل:

```bash
# طريقة 1: باستخدام gsutil (الطريقة الموصى بها)
gsutil cors set storage-cors.json gs://eduaiplatform-39fe9.firebasestorage.app

# طريقة 2: باستخدام Firebase CLI
firebase deploy --only storage
```

### ملفات الإعدادات المضافة

- `firebase.json` - إعدادات مشروع Firebase
- `storage-cors.json` - إعدادات CORS للخزنة
- `storage.rules` - قواعد الأمان للتخزين

### ملاحظة مهمة

إذا واجهت خطأ CORS مرة أخرى، تأكد من:
1. أنك تستخدم المنفذ الصحيح (5173 أو 5174)
2. أنك مسجل الدخول إلى Firebase
3. أن لديك صلاحيات كافية على المشروع
