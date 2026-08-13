export const clinicDefaults = {
  slug: "new-clinic",
  name: "New Clinic",
  shortName: "New Clinic",
  brandLine: "NEW CLINIC",
  city: "NHA TRANG",
  hours: "9:00–20:00",
  tagline: {
    ru: "Современная клиника в Нячанге.",
    en: "Modern clinic in Nha Trang.",
    vi: "Phòng khám hiện đại tại Nha Trang."
  },
  logo: "/client/logo.png",
  heroImage: "/client/hero.webp",
  welcomeImage: "/client/hero.webp",
  contacts: {
    phone: "+84",
    telegram: "",
    website: "",
    address: "Nha Trang, Vietnam",
    mapUrl: "https://www.google.com/maps/dir/?api=1&destination=Nha+Trang+Vietnam"
  },
  featuredServiceIds: ["consultation", "service-1"],
  defaultConsultationServiceId: "consultation",
  theme: {
    background: "#F7F5F0",
    surface: "#FFFFFF",
    text: "#20211D",
    muted: "#61645B",
    primary: "#68783C",
    primaryDark: "#4F5E2A",
    accent: "#B7D36B"
  }
};

export const services = [
  {
    id: "general",
    title: { ru: "Основное направление", en: "Main direction", vi: "Dịch vụ chính" },
    note: { ru: "Краткое описание направления", en: "Short direction description", vi: "Mô tả ngắn" },
    image: "/client/services/general.webp",
    items: [
      {
        id: "consultation",
        name: { ru: "Первичная консультация", en: "Initial consultation", vi: "Tư vấn ban đầu" },
        price: { ru: "По запросу", en: "On request", vi: "Liên hệ" },
        desc: { ru: "Первичный приём специалиста.", en: "Initial specialist appointment.", vi: "Buổi tư vấn đầu tiên." },
        image: "/client/services/consultation.webp"
      },
      {
        id: "service-1",
        name: { ru: "Услуга 1", en: "Service 1", vi: "Dịch vụ 1" },
        price: { ru: "По запросу", en: "On request", vi: "Liên hệ" },
        desc: { ru: "Описание услуги.", en: "Service description.", vi: "Mô tả dịch vụ." },
        image: "/client/services/service-1.webp"
      }
    ]
  }
];

export const specialists = [
  {
    id: "specialist-1",
    name: { ru: "Имя специалиста", en: "Specialist name", vi: "Tên chuyên gia" },
    role: { ru: "Специалист", en: "Specialist", vi: "Chuyên gia" },
    image: "/client/specialists/specialist-1.webp",
    tags: ["general"],
    serviceGroups: ["general"]
  }
];

export const translations = {
  ru: {
    nav: { home: "Главная", services: "Услуги", booking: "Запись", ai: "ИИ", profile: "Профиль" },
    home: { welcome: "Добро пожаловать", services: "Услуги и цены", specialists: "Специалисты", askAi: "Спросить ИИ", popular: "Популярные услуги", why: "Почему выбирают нас", whyItems: ["Понятная структура услуг", "Быстрая запись", "Связь с клиникой"] },
    services: { title: "Услуги и цены", subtitle: "Выберите направление и нужную услугу." },
    specialists: { title: "Специалисты", subtitle: "Выберите специалиста или направление." },
    booking: { title: "Запись на приём", service: "Выберите услугу", specialist: "Выберите специалиста", slot: "Дата и время", details: "Ваши данные", review: "Проверьте запись", name: "Имя", phone: "Телефон", continue: "Продолжить", back: "Назад", confirm: "Записаться", saved: "Запись создана", savedNote: "Данные записи сохранены. При подключённом backend они также отправляются в систему клиники." },
    ai: { title: "ИИ-консультант", subtitle: "Поможет сориентироваться в услугах и ценах. Диагноз не ставит.", placeholder: "Напишите вопрос…", ask: "Спросить", hello: "Здравствуйте! Расскажите, что вас интересует, и я помогу выбрать подходящее направление." },
    profile: { title: "Профиль", appointment: "Будущая запись", empty: "Записей пока нет" },
    common: { book: "Записаться", details: "Подробнее", all: "Смотреть все", today: "Сегодня", message: "Написать", route: "Маршрут", admin: "Демо-админка" }
  },
  en: {
    nav: { home: "Home", services: "Services", booking: "Book", ai: "AI", profile: "Profile" },
    home: { welcome: "Welcome", services: "Services & prices", specialists: "Specialists", askAi: "Ask AI", popular: "Popular services", why: "Why choose us", whyItems: ["Clear service structure", "Fast booking", "Clinic communication"] },
    services: { title: "Services & prices", subtitle: "Choose a direction and service." },
    specialists: { title: "Specialists", subtitle: "Choose a specialist or direction." },
    booking: { title: "Book an appointment", service: "Choose a service", specialist: "Choose a specialist", slot: "Date and time", details: "Your details", review: "Review appointment", name: "Name", phone: "Phone", continue: "Continue", back: "Back", confirm: "Book", saved: "Appointment created", savedNote: "The appointment is saved. With a connected backend it is also sent to the clinic system." },
    ai: { title: "AI assistant", subtitle: "Helps navigate services and prices. It does not diagnose.", placeholder: "Type your question…", ask: "Ask", hello: "Hello! Tell me what you need and I will help you choose the relevant direction." },
    profile: { title: "Profile", appointment: "Upcoming appointment", empty: "No appointments yet" },
    common: { book: "Book", details: "Details", all: "See all", today: "Today", message: "Message", route: "Directions", admin: "Admin demo" }
  },
  vi: {
    nav: { home: "Trang chủ", services: "Dịch vụ", booking: "Đặt lịch", ai: "AI", profile: "Hồ sơ" },
    home: { welcome: "Xin chào", services: "Dịch vụ & giá", specialists: "Chuyên gia", askAi: "Hỏi AI", popular: "Dịch vụ nổi bật", why: "Vì sao chọn chúng tôi", whyItems: ["Dịch vụ rõ ràng", "Đặt lịch nhanh", "Liên hệ phòng khám"] },
    services: { title: "Dịch vụ & giá", subtitle: "Chọn nhóm dịch vụ và dịch vụ phù hợp." },
    specialists: { title: "Chuyên gia", subtitle: "Chọn chuyên gia hoặc nhóm dịch vụ." },
    booking: { title: "Đặt lịch khám", service: "Chọn dịch vụ", specialist: "Chọn chuyên gia", slot: "Ngày và giờ", details: "Thông tin của bạn", review: "Kiểm tra lịch hẹn", name: "Họ tên", phone: "Điện thoại", continue: "Tiếp tục", back: "Quay lại", confirm: "Đặt lịch", saved: "Đã tạo lịch hẹn", savedNote: "Lịch hẹn đã được lưu. Khi backend được kết nối, dữ liệu cũng được gửi đến hệ thống phòng khám." },
    ai: { title: "Trợ lý AI", subtitle: "Hỗ trợ định hướng dịch vụ và giá. Không chẩn đoán.", placeholder: "Nhập câu hỏi…", ask: "Hỏi", hello: "Xin chào! Hãy cho biết nhu cầu của bạn, tôi sẽ giúp chọn hướng phù hợp." },
    profile: { title: "Hồ sơ", appointment: "Lịch hẹn sắp tới", empty: "Chưa có lịch hẹn" },
    common: { book: "Đặt lịch", details: "Chi tiết", all: "Xem tất cả", today: "Hôm nay", message: "Nhắn tin", route: "Chỉ đường", admin: "Quản trị demo" }
  }
};

export function asset(value) {
  return typeof value === "string" && value ? value : clinicDefaults.heroImage;
}
