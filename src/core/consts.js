export const uploadPath = {
  avatars: "uploads/avatars",
  vehicle: "public/vehicle",
  driver: "public/driver",
};
export const success = "success";
export const error = "error";
export const lang = "lang";
export const defaultPageSize = 10;
export const defaultPageSize2 = 12;
export const defaultLanguage = "en";

export const current = "current";

export const male = "M";
export const female = "F";

export const tokenLifetime = 24;
export const tokenStatus = {
  VALID: 1,
  EXPIRED: 2,
  NOT_FOUND: 3,
  ALREADY_USED: 4,
  EMAIL_NOT_FOUND: 5,
};

export const auth = {
  SOCIAL_SIGN_UP_PASSWORD: "",
};

export const social = {
  name: {
    GOOGLE: "Google",
    FACEBOOK: "Facebook",
  }
};


export const avatar = {
  DEFAULT_AVATAR: "images/default-avatar.png",
};

export const resetPasswordUri = "auth/reset-password";

export default {
  uploadPath,
  success,
  error,
  lang,
  defaultPageSize,
  defaultPageSize2,
  defaultLanguage,
  current,
  male,
  female,
  tokenLifetime,
  tokenStatus,
  auth,
  social,
  resetPasswordUri,
}
