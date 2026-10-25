/**
 * Privacy policy and terms content. Both languages live together so a change
 * to one is a visible prompt to update the other. The text describes only
 * behaviour that exists in this repository; legal review by the university
 * remains required (Egypt PDPL 151/2020).
 */

export const LEGAL_VERSION = "1.0";
export const LEGAL_UPDATED = "2026-10-25";

type Bilingual = { ar: string; en: string };
export type LegalSection = {
  heading: Bilingual;
  paragraphs?: Bilingual[];
  bullets?: Bilingual[];
};
export type LegalDoc = {
  title: Bilingual;
  intro: Bilingual;
  sections: LegalSection[];
};

export const PRIVACY: LegalDoc = {
  title: { ar: "سياسة الخصوصية", en: "Privacy policy" },
  intro: {
    ar: "توضح هذه السياسة أي بيانات يجمعها تطبيق حضور، ولماذا، وكيف تُستخدم وتُحمى، وما يمكنك فعله بشأنها. النسخة المعتمدة هي العربية، والترجمة الإنجليزية للتوضيح.",
    en: "This policy explains what data Hudoor collects, why, how it is used and protected, and what you can do about it. The Arabic version is authoritative; the English text is provided for clarity."
  },
  sections: [
    {
      heading: { ar: "1. من المسؤول عن بياناتك", en: "1. Who is responsible for your data" },
      paragraphs: [
        {
          ar: "الجامعة أو البرنامج الأكاديمي المشغّل لحضور هو المتحكم في بيانات الحضور والبيانات الأكاديمية. التطبيق أداة تشغيلية، ولا يبيع البيانات ولا يستخدمها لأغراض إعلانية.",
          en: "The university or academic program operating Hudoor is the controller of attendance and academic data. Hudoor is an operational tool; it does not sell data or use it for advertising."
        },
        {
          ar: "تخضع المعالجة لقانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020 وللوائح الجامعة. على الجامعة مراجعة التزاماتها مع مستشار قانوني قبل الإطلاق الرسمي، خاصة إذا استُضيفت البيانات خارج مصر.",
          en: "Processing is subject to Egypt's Personal Data Protection Law No. 151 of 2020 and university regulations. The university must confirm its obligations with legal counsel before official launch, especially if data is hosted outside Egypt."
        }
      ]
    },
    {
      heading: { ar: "2. البيانات التي نجمعها", en: "2. Data we collect" },
      bullets: [
        {
          ar: "بيانات الحساب: البريد الجامعي، كلمة المرور المُدارة بواسطة Supabase Auth، وحالة الحساب والدور.",
          en: "Account data: university email, password managed by Supabase Auth, account status and role."
        },
        {
          ar: "بيانات الدراسة: الاسم بالعربية والإنجليزية، الرقم الجامعي، البرنامج والمستوى والمجموعة، ورقم الهاتف.",
          en: "Study data: name in Arabic and English, university ID, program, level, group and phone number."
        },
        {
          ar: "بيانات التسجيل والحضور: المواد المسجّلة، الجلسات، وقت المسح، الحالة (حاضر/متأخر/غائب/بعذر)، وطريقة التسجيل.",
          en: "Enrollment and attendance data: enrolled courses, sessions, scan time, status (present/late/absent/excused) and marking method."
        },
        {
          ar: "بيانات الجهاز: معرّف جهاز عشوائي يُنشأ في المتصفح، ونوع المتصفح، ووقت ربط الجهاز. يُستخدم لمنع تسجيل الحضور من أكثر من هاتف.",
          en: "Device data: a random device identifier generated in the browser, browser type and binding time. Used to prevent attendance from more than one phone."
        },
        {
          ar: "بيانات أمنية: عنوان IP ومعرّف الجهاز عند رفض محاولة مسح أو اكتشاف إعادة استخدام رمز، لحماية نزاهة الحضور.",
          en: "Security data: IP address and device identifier when a scan is rejected or code reuse is detected, to protect attendance integrity."
        },
        {
          ar: "تفضيلاتك: اللغة، السمة، حجم النص، تقليل الحركة، وإعدادات الإشعارات وساعات الهدوء.",
          en: "Preferences: language, theme, text size, reduced motion, notification settings and quiet hours."
        }
      ]
    },
    {
      heading: { ar: "3. الموقع الجغرافي", en: "3. Location" },
      paragraphs: [
        {
          ar: "إذا كانت الجلسة تتطلب نطاقاً جغرافياً، يطلب المتصفح إذن الموقع أثناء المسح فقط. تُرسل الإحداثيات إلى الخادم لحساب المسافة من القاعة ثم تُهمل؛ لا نحفظ إحداثياتك في سجل الحضور.",
          en: "If a session requires a geofence, the browser asks for location permission only during scanning. Coordinates are sent to the server to calculate distance from the room and then discarded; they are not stored in the attendance record."
        },
        {
          ar: "رفض إذن الموقع يمنع المسح في الجلسات التي تشترط النطاق، لكنه لا يمنعك من رؤية حضورك أو تقديم عذر.",
          en: "Denying location permission prevents scanning in geofenced sessions, but does not stop you from viewing attendance or submitting an excuse."
        }
      ]
    },
    {
      heading: { ar: "4. لماذا نعالج البيانات", en: "4. Why we process data" },
      bullets: [
        { ar: "تسجيل الحضور والتحقق من التسجيل في المادة.", en: "Recording attendance and verifying course enrollment." },
        { ar: "منع انتحال الهوية، ومشاركة الرموز، وإعادة استخدام رمز قديم.", en: "Preventing impersonation, code sharing and replay of old codes." },
        { ar: "تمكين الأستاذ والإدارة من مراجعة الأعذار والاعتراضات وإصدار التقارير.", en: "Enabling instructors and administrators to review excuses and disputes and produce reports." },
        { ar: "إرسال إشعارات تشغيلية حسب تفضيلاتك.", en: "Sending operational notifications according to your preferences." },
        { ar: "الامتثال للوائح الجامعة وحماية حقوق الطلاب والموظفين.", en: "Complying with university regulations and protecting student and staff rights." }
      ]
    },
    {
      heading: { ar: "5. من يرى بياناتك", en: "5. Who can see your data" },
      paragraphs: [
        {
          ar: "ترى أنت بياناتك. يرى أستاذ المادة حضور الطلاب المسجلين في مقرره. ترى الإدارة والمنسقون ما يلزم لأداء مهامهم ضمن نطاق البرنامج والصلاحيات الممنوحة، ويُسجَّل الوصول الإداري الحساس في سجل التدقيق.",
          en: "You can see your own data. A course instructor sees attendance for students enrolled in that course. Administrators and coordinators see what their role requires within their program scope, and sensitive administrative access is recorded in the audit log."
        },
        {
          ar: "نستخدم مزودي استضافة ومعالجة (Supabase لقاعدة البيانات والمصادقة، وVercel للتشغيل) وفق اتفاقياتهم. لا نشارك البيانات مع أطراف أخرى إلا بموجب القانون أو طلب رسمي من جهة مختصة.",
          en: "We use hosting and processing providers (Supabase for database and authentication, Vercel for hosting) under their agreements. We do not share data with other parties except as required by law or a formal request from a competent authority."
        }
      ]
    },
    {
      heading: { ar: "6. مدة الاحتفاظ", en: "6. Retention" },
      bullets: [
        { ar: "سجلات الحضور الأكاديمية تُحفظ وفق مدة الاحتفاظ التي تحددها الجامعة، لأنها جزء من السجل الدراسي.", en: "Academic attendance records are kept for the period set by the university because they form part of the academic record." },
        { ar: "سجل رموز المسح (qr_scans) يُحذف تلقائياً بعد 30 يوماً.", en: "The scan-nonce ledger (qr_scans) is deleted automatically after 30 days." },
        { ar: "سجلات التدقيق والمحاولات المرفوضة تُحفظ للمراجعة الأمنية والإدارية، ولا تُحذف تلقائياً حالياً.", en: "Audit logs and rejected attempts are retained for security and administrative review and are not currently deleted automatically." },
        { ar: "عند الموافقة على طلب حذف الحساب، تُحذف البيانات أو تُجهَّل وفق ما يسمح به السجل الأكاديمي واللوائح. قد تبقى نسخ احتياطية لفترة محدودة لدى مزود الاستضافة.", en: "When an account-deletion request is approved, data is deleted or anonymised as far as the academic record and regulations allow. Backup copies may persist for a limited period at the hosting provider." }
      ]
    },
    {
      heading: { ar: "7. حقوقك", en: "7. Your rights" },
      bullets: [
        { ar: "الاطلاع والتصدير: زر «تصدير بياناتي» في صفحة حسابي ينزّل نسخة JSON من بياناتك.", en: "Access and export: the “Export my data” button on the Me page downloads a JSON copy of your data." },
        { ar: "التصحيح: اطلب تصحيح الاسم أو الرقم الجامعي أو البرنامج من إدارة البرنامج.", en: "Correction: ask your program administration to correct your name, university ID or program." },
        { ar: "الحذف أو التجهيل: اطلب حذف الحساب من صفحة حسابي، ويُراجع الطلب قبل التنفيذ.", en: "Deletion or anonymisation: request account deletion from the Me page; the request is reviewed before action." },
        { ar: "سحب الموافقة: يمكنك التوقف عن استخدام التطبيق أو طلب إغلاق حسابك، مع العلم أن بعض بيانات الحضور إلزامية للسجل الأكاديمي.", en: "Withdrawing consent: you may stop using the app or request account closure, understanding that some attendance data is mandatory for the academic record." },
        { ar: "الشكاوى: تواصل أولاً مع إدارة البرنامج، ويمكنك اللجوء إلى الجهة الرقابية المختصة وفق القانون.", en: "Complaints: contact your program administration first; you may also approach the competent supervisory authority under the law." }
      ]
    },
    {
      heading: { ar: "8. الأمان", en: "8. Security" },
      paragraphs: [
        {
          ar: "نستخدم اتصالاً مشفراً، وتحققاً من الجلسة على الخادم، وسياسات وصول على مستوى الصفوف في قاعدة البيانات، وربط الجهاز، وصلاحيات دقيقة لكل دور. لا يمكن لأي طالب قراءة بيانات طالب آخر عبر واجهات التطبيق.",
          en: "We use encrypted connections, server-side session checks, row-level security in the database, device binding and role-scoped permissions. A student cannot read another student's data through the app's interfaces."
        },
        {
          ar: "لا يوجد نظام آمن بنسبة 100%. إذا لاحظت وصولاً غير مصرح به، أبلغ إدارة البرنامج فوراً.",
          en: "No system is 100% secure. If you notice unauthorised access, report it to your program administration immediately."
        }
      ]
    },
    {
      heading: { ar: "9. التغييرات والتواصل", en: "9. Changes and contact" },
      paragraphs: [
        {
          ar: "قد نحدّث هذه السياسة عند تغيير طريقة المعالجة أو اللوائح، وسيظهر تاريخ التحديث أعلى الصفحة. التغييرات الجوهرية تُبلَّغ داخل التطبيق.",
          en: "We may update this policy when processing or regulations change; the update date appears at the top of this page. Material changes are announced in the app."
        },
        {
          ar: "لأي سؤال أو طلب يتعلق ببياناتك، تواصل مع إدارة البرنامج أو منسق الخصوصية المعيّن من الجامعة.",
          en: "For any question or request about your data, contact your program administration or the university's designated privacy coordinator."
        }
      ]
    }
  ]
};

export const TERMS: LegalDoc = {
  title: { ar: "شروط الاستخدام", en: "Terms of use" },
  intro: {
    ar: "باستخدامك تطبيق حضور فإنك توافق على هذه الشروط وعلى لوائح الجامعة. النسخة المعتمدة هي العربية، والترجمة الإنجليزية للتوضيح.",
    en: "By using Hudoor you agree to these terms and to university regulations. The Arabic version is authoritative; the English text is provided for clarity."
  },
  sections: [
    {
      heading: { ar: "1. الأهلية والحساب", en: "1. Eligibility and account" },
      paragraphs: [
        {
          ar: "التطبيق مخصص للطلاب وأعضاء هيئة التدريس والموظفين المسجلين في البرنامج. يجب أن تكون بيانات التسجيل صحيحة وأن تحافظ على سرية كلمة المرور.",
          en: "The app is for students, faculty and staff enrolled in the program. Registration data must be accurate and you must keep your password confidential."
        },
        {
          ar: "الحساب شخصي. لا تشارك بيانات الدخول، ولا تسجّل الحضور نيابة عن غيرك.",
          en: "Accounts are personal. Do not share sign-in credentials or record attendance on behalf of anyone else."
        }
      ]
    },
    {
      heading: { ar: "2. الاستخدام المقبول", en: "2. Acceptable use" },
      bullets: [
        { ar: "استخدم التطبيق لأغراض الحضور والتواصل الأكاديمي فقط.", en: "Use the app only for attendance and academic communication." },
        { ar: "لا تحاول تعطيل الخدمة أو اختراقها أو تجاوز صلاحياتك.", en: "Do not attempt to disrupt, hack or bypass the service or your permissions." },
        { ar: "لا تلتقط رموز الحضور أو تشاركها أو تعيد استخدامها خارج الجلسة.", en: "Do not capture, share or reuse attendance codes outside the session." },
        { ar: "لا تزوّر الموقع الجغرافي أو تستخدم محاكياً للموقع لتسجيل حضور غير حقيقي.", en: "Do not spoof location or use a location simulator to record false attendance." },
        { ar: "لا ترفع محتوى مخالفاً للقانون أو للوائح الجامعة.", en: "Do not upload content that violates the law or university regulations." }
      ]
    },
    {
      heading: { ar: "3. الرموز والجهاز", en: "3. Codes and devices" },
      paragraphs: [
        {
          ar: "رمز الحضور يتجدد كل ثوانٍ وينتهي بسرعة. مشاركة الرمز أو تصويره لا تضمن قبول المسح، وقد تُسجَّل المحاولة كمخالفة.",
          en: "The attendance code rotates every few seconds and expires quickly. Sharing or photographing it does not guarantee acceptance and may be recorded as a violation."
        },
        {
          ar: "يُربط حساب الطالب بجهاز واحد. تغيير الجهاز يتطلب طلباً يوافق عليه الأدمن. محاولة المسح من جهاز آخر قد تُرفض وتُسجَّل.",
          en: "A student account is bound to one device. Changing devices requires an admin-approved request. Scanning from another device may be rejected and logged."
        }
      ]
    },
    {
      heading: { ar: "4. قرارات الحضور", en: "4. Attendance decisions" },
      paragraphs: [
        {
          ar: "التسجيل عبر التطبيق دليل تشغيلي، والقرار النهائي في الحضور والغياب والأعذار يعود للأستاذ والإدارة وفق لوائح الجامعة.",
          en: "An app record is operational evidence; the final decision on attendance, absence and excuses rests with the instructor and administration under university regulations."
        },
        {
          ar: "يمكنك الاعتراض على سجل أو تقديم عذر من صفحة الحضور. تقديم الطلب لا يغيّر الحالة تلقائياً؛ التغيير يحدث بعد المراجعة.",
          en: "You may dispute a record or submit an excuse from the attendance page. Submitting a request does not change the status automatically; it changes after review."
        }
      ]
    },
    {
      heading: { ar: "5. التوفر والتغييرات", en: "5. Availability and changes" },
      paragraphs: [
        {
          ar: "نسعى لإتاحة الخدمة باستمرار، لكن قد تحدث انقطاعات للصيانة أو الشبكة أو مزود الاستضافة. لا نضمن إتاحة غير منقطعة.",
          en: "We aim to keep the service available, but maintenance, network or hosting outages may occur. We do not guarantee uninterrupted availability."
        },
        {
          ar: "قد نغيّر الميزات أو هذه الشروط، وسنعرض تاريخ التحديث. استمرارك في الاستخدام بعد التغيير يعني قبولك للنسخة المحدّثة.",
          en: "We may change features or these terms and will show the update date. Continued use after a change means you accept the updated version."
        }
      ]
    },
    {
      heading: { ar: "6. إنهاء الحساب", en: "6. Account termination" },
      paragraphs: [
        {
          ar: "يمكنك طلب حذف حسابك من صفحة حسابي. يجوز للجامعة تعليق أو إنهاء الوصول عند مخالفة اللوائح أو عند انتهاء الصفة الأكاديمية.",
          en: "You may request account deletion from the Me page. The university may suspend or terminate access for breach of regulations or when academic status ends."
        },
        {
          ar: "تبقى الأحكام المتعلقة بالسجل الأكاديمي والمسؤولية والخصوصية سارية بعد إنهاء الحساب حيثما يقتضي القانون.",
          en: "Provisions concerning academic records, liability and privacy survive account termination where the law requires."
        }
      ]
    },
    {
      heading: { ar: "7. الملكية الفكرية", en: "7. Intellectual property" },
      paragraphs: [
        {
          ar: "واجهة التطبيق وشفرته وتصميمه مملوكة لمطوّريه وللجامعة حسب الاتفاق. محتوى المواد والجداول والملاحظات يبقى ملكاً لأصحابه.",
          en: "The app's interface, code and design belong to its developers and the university as agreed. Course content, timetables and notes remain the property of their owners."
        }
      ]
    },
    {
      heading: { ar: "8. حدود المسؤولية", en: "8. Liability" },
      paragraphs: [
        {
          ar: "يُقدَّم التطبيق كأداة مساعدة ضمن حدود القانون. لا تتحمل الجامعة مسؤولية فقدان بيانات ناتج عن قوة قاهرة أو سوء استخدام من المستخدم، دون الإخلال بحقوقك القانونية.",
          en: "The app is provided as an aid within the limits of the law. The university is not liable for data loss caused by force majeure or user misuse, without prejudice to your statutory rights."
        }
      ]
    },
    {
      heading: { ar: "9. القانون والتواصل", en: "9. Law and contact" },
      paragraphs: [
        {
          ar: "تخضع هذه الشروط لأحكام القانون المصري ولوائح الجامعة. لأي سؤال، تواصل مع إدارة البرنامج.",
          en: "These terms are governed by Egyptian law and university regulations. For any question, contact your program administration."
        }
      ]
    }
  ]
};
