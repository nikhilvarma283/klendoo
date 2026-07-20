// User & Host
export interface User {
  id: string;
  email: string;
  name?: string;
  walletAddress?: string;
  googleCalendarId?: string;
  profilePhoto?: string;
  bio?: string;
  timezone: string;
  isVerified: boolean;
  bookingPageSlug?: string;
  createdAt: Date;
}

// Session Type
export interface SessionType {
  id: string;
  userId: string;
  name: string;
  durationMinutes: number;
  isPaid: boolean;
  priceUSDC?: number;
  description?: string;
}

// Booking
export interface Booking {
  id: string;
  userId: string;
  visitorName: string;
  visitorEmail: string;
  sessionTypeId: string;
  startTime: Date;
  endTime: Date;
  googleEventId?: string;
  confirmationEmailSent: boolean;
  status: "confirmed" | "cancelled" | "rescheduled";
  visitorWalletAddress?: string;
  pricePaidUSDC?: number;
  createdAt: Date;
}

// Settlement (x402 micropayment)
export interface Settlement {
  id: string;
  hostId: string;
  actionType: "booking" | "follow-up" | "reminder";
  amountUSDC: number;
  txnHash?: string;
  confirmed: boolean;
  confirmationTime?: Date;
  bookingId?: string;
  measurementWindow: boolean;
  failureReason?: string;
  createdAt: Date;
}

// Chat Message
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  userEmail?: string;
  createdAt: Date;
}

// Orchestration Agent Request/Response
export interface OrchestrationRequest {
  sessionId: string;
  userEmail?: string;
  userRole: "visitor" | "host";
  message: string;
  context?: {
    bookingId?: string;
    userId?: string;
  };
}

export interface OrchestrationResponse {
  sessionId: string;
  message: string;
  actionType?: "book" | "check_availability" | "send_followup" | "reschedule" | "cancel";
  actionPayload?: Record<string, any>;
  actionButtons?: Array<{
    label: string;
    action: string;
    payload?: Record<string, any>;
  }>;
}

// Payment Settlement Request
export interface SettlementRequest {
  hostWalletAddress: string;
  actionType: "booking" | "follow-up" | "reminder";
  amountUSDC: number;
  bookingId?: string;
}

export interface SettlementResponse {
  transactionHash: string;
  confirmed: boolean;
  settlementId: string;
  estimatedConfirmationTime?: number; // seconds
}

// Google Calendar Availability
export interface CalendarSlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
}

export interface CalendarAvailability {
  hostEmail: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  slots: CalendarSlot[];
}

// API Response Wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}

// Booking Request (from visitor)
export interface CreateBookingRequest {
  visitorName: string;
  visitorEmail: string;
  sessionTypeId: string;
  startTime: Date;
  endTime: Date;
  hostSlug?: string; // From URL /book/host-slug
  visitorWalletAddress?: string; // For paid sessions
}

// Follow-up Request
export interface SendFollowupRequest {
  bookingId: string;
  customMessage?: string;
}

// Reminder Request
export interface SendReminderRequest {
  bookingId: string;
  reminderOffsetMinutes?: number; // Minutes before session
}
