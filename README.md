# Smart Router Control — Android APK & Local Gateway Manager

## طريقة استخراج ملف الـ APK لتثبيته على الموبايل (بدون تعقيد)

المشروع مجهز بالكامل بـ **Capacitor Android** ومفعّل فيه `CapacitorHttp` و `usesCleartextTraffic="true"` عشان تطبيق الموبايل يتصل مباشرة بالراوتر (`http://192.168.1.1`) من غير أي مشاكل CORS أو قيود متصفح.

### الطريقة الأولى: استخراج الـ APK أوتوماتيكياً عبر GitHub Actions (بدون تسطيب Android Studio على جهازك)
1. ارفع محتويات الفولدر ده على حسابك في GitHub (Repository جديد).
2. ادخل على تبويب **Actions** جوه الـ Repository واضغط على **Build Android APK** ثم **Run workflow**.
3. في خلال دقيقتين هيطلع لك ملف **`Smart-Router-Control-APK.zip`** جاهز، حمله وفك الضغط هتلاقي ملف `app-debug.apk` ثبّته على موبايلك فوراً.

### الطريقة الثانية: بناء الـ APK على جهازك بضغطة واحدة
- **على ويندوز:** اضغط دبل كليك على ملف `build-apk.bat`.
- **على لينكس / ماك:** شغّل الأمر:
  ```bash
  ./build-apk.sh
  ```
هتلاقي ملف الـ APK جاهز في المسار:
`android/app/build/outputs/apk/debug/app-debug.apk`
