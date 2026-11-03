/** Mirrors the `user_role` enum in the API. */
export type UserRole = "CLIENT" | "CLINIC_MANAGER" | "ADMIN";

export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

/**
 * Dashboard mock data still uses extra cancellation variants. The live API
 * enum is PENDING / CONFIRMED / CANCELLED / COMPLETED.
 */
export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "CANCELLED_BY_CLIENT"
  | "CANCELLED_BY_CLINIC"
  | "NO_SHOW";

export type ApiAppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED";

// --------------------------------------------------------------------------- //
// API payloads — snake_case, matching the FastAPI schemas exactly.
// --------------------------------------------------------------------------- //

export interface ApiUser {
  id: number;
  mobile_number: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Response from `POST /auth/login`. */
export interface OtpRequestResponse {
  message: string;
  expires_in: number;
  resend_after: number;
  /** Present only outside production, so the flow can be tested without SMS. */
  debug_code: string | null;
}

/** Response from `POST /auth/verify`. */
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: ApiUser;
  is_new_user: boolean;
}

export interface ApiClinicProfile {
  id: number;
  user_id: number;
  clinic_name: string;
  address: string;
  contact_number: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

/** Response from `GET /clinics/me`. `id` is null until the manager saves a profile. */
export interface ClinicMeResponse {
  id: number | null;
  user_id: number;
  clinic_name: string;
  address: string;
  contact_number: string;
  is_verified: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface CatalogService {
  id: number;
  service_name: string;
  description?: string | null;
  duration_minutes: number;
  price: string | number;
}

export interface CatalogClinic {
  id: number;
  clinic_name: string;
  address: string;
  services: CatalogService[];
}

/** Response from `GET /clinics/public/{id}`. */
export interface PublicClinicProfile {
  id: number;
  clinic_name: string;
  address: string;
  contact_number: string;
  description: string;
  is_verified: boolean;
  services: CatalogService[];
}

/** Response from `GET /clinics/public`. */
export interface PublicClinicListItem {
  id: number;
  clinic_name: string;
  address: string;
  contact_number: string;
  is_verified: boolean;
  service_count: number;
  starting_price: number | null;
}

export interface AvailableSlotsResponse {
  jalali_date: string;
  clinic_id: number;
  slots: string[];
}

export interface ApiAppointment {
  id: number;
  clinic_id: number;
  client_id: number;
  service_id: number;
  jalali_date: string;
  start_time: string;
  end_time: string;
  status: ApiAppointmentStatus;
  created_at: string;
  updated_at: string;
}

export interface AppointmentBookResponse {
  message: string;
  appointment: ApiAppointment;
}

export interface ClinicAppointmentClient {
  id: number;
  mobile_number: string;
}

export interface ClinicAppointmentService {
  id: number;
  service_name: string;
  duration_minutes: number;
  price: number;
}

/** Response from `GET /appointments/me` and `PATCH /appointments/client/{id}/cancel`. */
export interface ClientAppointmentRow {
  id: number;
  clinic_id: number;
  jalali_date: string;
  time_slot: string;
  start_time: string;
  end_time: string;
  status: ApiAppointmentStatus;
  created_at: string;
  updated_at: string;
  clinic: {
    id: number;
    clinic_name: string;
    address: string;
  };
  service: ClinicAppointmentService;
}

/** Response from `GET /appointments/clinic` and `PATCH /appointments/clinic/{id}/status`. */
export interface ClinicAppointmentRow {
  id: number;
  clinic_id: number;
  jalali_date: string;
  time_slot: string;
  start_time: string;
  end_time: string;
  status: ApiAppointmentStatus;
  created_at: string;
  updated_at: string;
  client: ClinicAppointmentClient;
  service: ClinicAppointmentService;
}

/** Response from `GET /clinics/me/stats`. */
export interface ClinicStatsResponse {
  jalali_date: string;
  today_appointments: number;
  pending_count: number;
  estimated_revenue: number;
  upcoming: ClinicAppointmentRow[];
}

// --------------------------------------------------------------------------- //
// UI view models — still backed by mock data until the directory API lands.
// --------------------------------------------------------------------------- //

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  clinicCount: number;
}

export interface District {
  id: number;
  name: string;
  slug: string;
  clinicCount: number;
}

export interface ClinicSummary {
  id: number;
  name: string;
  slug: string;
  district: string;
  coverImage: string;
  categories: string[];
  rating: number;
  reviewCount: number;
  startingPrice: number;
  isVerified: boolean;
  hasInstantBooking: boolean;
}
