const fs = require('fs');

// Read English translation file
const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));

// Arabic translations map
const arTranslations = {
  // App
  "title": "منصة البرامج الأكاديمية للجامعات اليمنية",
  "description": "منصة تعليمية ذكية مصممة لطلاب الجامعات اليمنية",
  "slogan": "تعليم ذكي وتفاعلي",
  // Nav
  "home": "الرئيسية",
  "discussions": "المناقشات",
  "chat": "الدردشة",
  "recommendations": "التوصيات",
  "upload": "رفع الملفات",
  "admin": "لوحة التحكم",
  "adminReports": "التقارير والتحليلات",
  "aiAssistant": "المساعد الذكي",
  "login": "تسجيل الدخول",
  "profile": "الملف الشخصي",
  "logout": "تسجيل الخروج",
  // Auth
  "loginSuccess": "تم تسجيل الدخول بنجاح",
  "loginError": "فشل تسجيل الدخول",
  "loginWithGoogle": "تسجيل الدخول بحساب Google",
  "noAccount": "ليس لديك حساب؟ سجل الآن",
  "alreadyHaveAccount": "لديك حساب بالفعل؟ تسجيل الدخول",
  "forgotPassword": "نسيت كلمة المرور؟",
  "aiLoginRequired": "يرجى التسجيل لاستخدام خدمات الذكاء الاصطناعي",
  "register": "إنشاء حساب",
  "defaultStudent": "سيتم تسجيلك كطالب افتراضيًا",
  "registerSuccess": "تم إنشاء الحساب بنجاح",
  "registerError": "فشل إنشاء الحساب",
  "guest": "زائر",
  "resetPasswordSuccess": "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد أو مجلد البريد العشوائي.",
  "resetPasswordError": "حدث خطأ. يرجى التأكد من صحة البريد الإلكتروني.",
  "backToLogin": "العودة لتسجيل الدخول",
  "email": "البريد الإلكتروني",
  "password": "كلمة المرور",
  "confirmPassword": "تأكيد كلمة المرور",
  "nameRequired": "الاسم مطلوب",
  "nameMinLength": "الاسم يجب أن يكون على الأقل حرفين",
  "emailRequired": "البريد الإلكتروني مطلوب",
  "emailInvalid": "البريد الإلكتروني غير صالح",
  "passwordRequired": "كلمة المرور مطلوبة",
  "passwordMinLength": "كلمة المرور يجب أن تكون على الأقل 6 أحرف",
  "confirmPasswordRequired": "تأكيد كلمة المرور مطلوب",
  "passwordsMismatch": "كلمات المرور غير متطابقة",
  "copyright": "منصة البرامج الأكاديمية للجامعات اليمنية. جميع الحقوق محفوظة",
  "appName": "منصة البرامج الأكاديمية للجامعات اليمنية",
  // Chat
  "publicChat": "دردشة عامة",
  "privateChat": "دردشة خاصة",
  "send": "إرسال",
  "typeMessage": "اكتب رسالة...",
  "noMessages": "لا توجد رسائل بعد",
  "online": "متصل",
  "offline": "غير متصل",
  "courseChat": "دردشة المادة",
  "generalChat": "دردشة عامة",
  "privateChatLabel": "محادثة خاصة",
  "noMessageYet": "لا توجد رسائل بعد",
  "beFirst": "كن أول من يرسل رسالة!",
  "coursePrivateChat": "هذه الدردشة خاصة بمادة {{courseName}}",
  "replyTo": "رد على:",
  "cancelReply": "إلغاء الرد",
  "sendMessage": "إرسال الرسالة",
  "loadingMessages": "جاري تحميل الرسائل...",
  "verifyingLogin": "جاري التحقق من تسجيل الدخول...",
  "reply": "رد",
  "copy": "نسخ",
  "deleteForEveryone": "حذف للجميع",
  "hideMessage": "إخفاء الرسالة",
  "markAsRead": "تحديد كمقروء",
  "loadPreviousMessages": "تحميل الرسائل السابقة",
  "messageDeleted": "تم حذف هذه الرسالة",
  "edited": "(تم التعديل)",
  "addEmoji": "إضافة رمز تعبيري",
  "openPrivateChats": "فتح قائمة الدردشات الخاصة",
  "backToGeneralChat": "العودة للدردشة العامة",
  "usersInGeneralChat": "المستخدمون في الدردشة العامة",
  "selectUserForPrivateChat": "اختر مستخدم لبدء محادثة خاصة",
  "noUsersInGeneralChat": "لم يرسل أي مستخدم رسائل في الدردشة العامة بعد",
  "copyMessage": "تم نسخ الرسالة",
  "messageCopied": "تم نسخ الرسالة",
  "messageHidden": "تم إخفاء الرسالة",
  "pleaseLogin": "يرجى تسجيل الدخول",
  "errorDeletingMessage": "حدث خطأ أثناء حذف الرسالة",
  "deleteDiscussionConfirm": "هل أنت متأكد من حذف هذه المناقشة؟ سيتم حذف جميع الردود أيضاً.",
  "deleteDiscussionError": "حدث خطأ أثناء حذف المناقشة",
  "discussionUpdated": "تم تحديث المناقشة",
  "discussionUpdateError": "حدث خطأ أثناء تحديث المناقشة",
  "discussionCreated": "تم إنشاء المناقشة",
  "discussionCreateError": "حدث خطأ أثناء إنشاء المناقشة",
  "commentAdded": "تم إضافة التعليق",
  "commentAddError": "حدث خطأ أثناء إضافة التعليق",
  "likeLoginRequired": "يرجى تسجيل الدخول للإعجاب",
  "loginToComment": "يرجى تسجيل الدخول للتعليق",
  "editDiscussion": "تعديل المناقشة",
  "deleteDiscussion": "حذف المناقشة",
  "newDiscussion": "مناقشة جديدة",
  "discussionsList": "قائمة المناقشات",
  "searchDiscussions": "البحث في المناقشات...",
  "allCourses": "جميع المواد",
  "selectCourse": "اختر المادة (اختياري)",
  "noDiscussionsMatch": "لا توجد مناقشات تطابق بحثك",
  "noDiscussionsYet": "لا توجد مناقشات بعد. كن أول من يبدأ واحدة!",
  "noDiscussionsToShow": "لا توجد مناقشات لعرضها بعد",
  "loginToParticipate": "يرجى تسجيل الدخول للمشاركة في المناقشات",
  "loginToView": "يرجى تسجيل الدخول لعرض هذا المحتوى",
  "backToDiscussions": "العودة للمناقشات",
  "discussionLoadError": "خطأ في تحميل المناقشة",
  "editComment": "تعديل الرد",
  "deleteComment": "حذف الرد",
  "replyPlaceholder": "اكتب تعليقك...",
  "discussionTitle": "عنوان المناقشة",
  "discussionContent": "محتوى المناقشة",
  "publishDiscussion": "نشر المناقشة",
  "cancel": "إلغاء",
  "saveEdit": "حفظ التغييرات",
  "close": "إغلاق",
  "deleteReplyConfirm": "هل أنت متأكد من حذف هذا الرد؟",
  "deleteReplyError": "حدث خطأ أثناء حذف الرد",
  "commentEditError": "حدث خطأ أثناء تعديل التعليق",
  "commentCreateError": "حدث خطأ أثناء إنشاء التعليق",
  "enterTitleAndContent": "يرجى إدخال عنوان ومحتوى للمناقشة",
  "comments": "التعليقات",
  "noCommentsYet": "لا توجد تعليقات بعد. كن أول من يعلق!",
  "noCommentsYetShort": "لا توجد تعليقات بعد",
  "courseName": "اسم المادة",
  "courseChatBtn": "دردشة المادة",
  "generalChatBtn": "دردشة عامة",
  "privateChatBtn": "محادثة خاصة",
  "noUsersYet": "لم يرسل أي مستخدم رسائل في الدردشة العامة بعد",
  "loadingUsers": "جاري التحميل...",
  "messageSent": "تم إرسال الرسالة",
  "deleteForMe": "تم إخفاء الرسالة",
  "edit": "تعديل",
  "deleteAsAdmin": "حذف كمسؤول",
  "hide": "إخفاء",
  "loadOlder": "تحميل الرسائل السابقة",
  "loadNewMessages": "تحميل الرسائل الجديدة",
  "scrollToBottom": "انتقل للأسفل",
  "thisChatIsCourse": "هذه الدردشة خاصة بمادة {{courseName}}",
  "loggedInRequired": "يرجى تسجيل الدخول",
  "errorSendingMessage": "حدث خطأ أثناء إرسال الرسالة",
  "activeStatus": "نشط",
  "privateChatNoMessages": "لا توجد رسائل خاصة بعد",
  "privateChatStartNow": "ابدأ المحادثة الآن!",
  "privateMessagePlaceholder": "اكتب رسالة خاصة لـ {{name}}...",
  "deleteMessageTitle": "تم حذف رسالة",
  "deleteMessageBody": "تم حذف رسالة من المحادثة",
  // Already in English file (Arabic values that were kept)
  "activeCourse": "نشط",
  "chooseCourse": "اختر المادة (اختياري)",
  "courseTool": "المادة",
  "discussionsError": "حدث خطأ في تحميل المناقشة",
  "discussionsTitle": "منصة النقاشات والمناقشات",
  "generalDiscussion": "مناقشة عامة",
  "likeLogin": "الرجاء تسجيل الدخول للإعجاب",
  "loadingDiscussions": "جاري تحميل المناقشات...",
  "logInBtn": "تسجيل الدخول",
  "logInParticipate": "الرجاء تسجيل الدخول للمشاركة في المناقشات",
  "logInView": "الرجاء تسجيل الدخول لعرض هذا المحتوى",
  "noDiscussionsFewFirst": "لا توجد مناقشات بعد. كن أول من يبدأ مناقشة!",
  "noDiscussionsShow": "لا توجد مناقشات لعرضها بعد",
  "pubChat": "دردشة عامة",
  "publish": "نشر",
  "replyError": "حدث خطأ أثناء إضافة الرد",
  "replySuccess": "تم إضافة الرد بنجاح",
  "searchPlaceholder": "البحث في المناقشات...",
  "siteAdmin": "مدير الموقع"
};

/**
 * Recursively build Arabic translation object matching English structure
 */
function buildArabic(obj, section) {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      result[key] = buildArabic(val, key);
    } else if (typeof val === 'string') {
      // Check if we have an Arabic translation for this key
      // If the text already contains Arabic characters, keep it
      if (/[\u0600-\u06FF]/.test(val)) {
        result[key] = val;
      } else if (arTranslations[key]) {
        result[key] = arTranslations[key];
      } else {
        // Fallback to English if no translation available
        result[key] = val;
      }
    } else {
      result[key] = val;
    }
  }
  return result;
}

const arabicTranslation = buildArabic(en, 'root');

// Write the file
fs.writeFileSync('src/locales/ar/translation.json', JSON.stringify(arabicTranslation, null, 2), 'utf8');
console.log('✅ Arabic translation file written successfully!');

// Validate JSON
const test = JSON.parse(fs.readFileSync('src/locales/ar/translation.json', 'utf8'));
console.log('✅ Valid JSON!');
console.log('📊 Top-level sections:', Object.keys(test).length);
console.log('📊 Chat keys:', Object.keys(test.chat).length);
console.log('🔽 scrollToBottom:', test.chat.scrollToBottom);

