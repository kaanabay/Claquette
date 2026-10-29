// Turkish messages for Better Auth error codes (shared by client and server forms).
const MESSAGES: Record<string, string> = {
  INVALID_USERNAME_OR_PASSWORD: "Kullanıcı adı veya şifre hatalı.",
  INVALID_EMAIL_OR_PASSWORD: "E-posta veya şifre hatalı.",
  USERNAME_IS_ALREADY_TAKEN: "Bu kullanıcı adı alınmış.",
  USER_ALREADY_EXISTS: "Bu e-posta ile kayıtlı bir hesap var.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Bu e-posta ile kayıtlı bir hesap var.",
  USERNAME_TOO_SHORT: "Kullanıcı adı en az 3 karakter olmalı.",
  USERNAME_TOO_LONG: "Kullanıcı adı en fazla 30 karakter olabilir.",
  INVALID_USERNAME: "Kullanıcı adında yalnızca harf, rakam, nokta ve alt çizgi kullanılabilir.",
  INVALID_EMAIL: "Geçerli bir e-posta adresi gir.",
  INVALID_PASSWORD: "Mevcut şifren hatalı.",
  PASSWORD_TOO_SHORT: "Şifre en az 8 karakter olmalı.",
  PASSWORD_TOO_LONG: "Şifre çok uzun.",
};

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (error?.status === 429) return "Çok fazla deneme yaptın. Birkaç saniye bekleyip tekrar dene.";
  return (error?.code && MESSAGES[error.code]) || "Bir şeyler ters gitti. Lütfen tekrar dene.";
}
