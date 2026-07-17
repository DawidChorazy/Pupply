const jsonBody = (schema: object) => ({
  required: true,
  content: { "application/json": { schema } }
});

const jsonResponse = (description: string, schema?: object) => ({
  description,
  ...(schema ? { content: { "application/json": { schema } } } : {})
});

const standardErrors = {
  "400": { $ref: "#/components/responses/ValidationError" },
  "401": { $ref: "#/components/responses/Unauthorized" },
  "403": { $ref: "#/components/responses/Forbidden" },
  "404": { $ref: "#/components/responses/NotFound" },
  "409": { $ref: "#/components/responses/Conflict" },
  "429": { $ref: "#/components/responses/RateLimited" },
  "500": { $ref: "#/components/responses/InternalError" }
};

const bearer = [{ bearerAuth: [] }];
const idParameter = (name: string) => ({ name, in: "path", required: true, schema: { type: "string" } });

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Pupply Backend API",
    version: "2.0.0",
    description: "Authentication, pet profiles, sitter marketplace, bookings and notifications."
  },
  servers: [{ url: "http://localhost:4000", description: "Local development" }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Users" },
    { name: "Clinics" },
    { name: "Pets" },
    { name: "Uploads" },
    { name: "Sitters" },
    { name: "Bookings" },
    { name: "Notifications" }
  ],
  paths: {
    "/api/health": {
      get: { tags: ["Health"], summary: "Process health", responses: { "200": jsonResponse("Healthy", { $ref: "#/components/schemas/Status" }) } }
    },
    "/api/ready": {
      get: {
        tags: ["Health"],
        summary: "Database readiness",
        responses: {
          "200": jsonResponse("Ready", { $ref: "#/components/schemas/Status" }),
          "503": jsonResponse("Database unavailable", { $ref: "#/components/schemas/Error" })
        }
      }
    },
    "/api/auth/register/user": {
      post: {
        tags: ["Auth"], summary: "Register user", requestBody: jsonBody({ $ref: "#/components/schemas/RegisterUserRequest" }),
        responses: { "201": jsonResponse("Registered", { $ref: "#/components/schemas/AuthResponse" }), ...standardErrors }
      }
    },
    "/api/auth/register/clinic": {
      post: {
        tags: ["Auth"], summary: "Register clinic", requestBody: jsonBody({ $ref: "#/components/schemas/RegisterClinicRequest" }),
        responses: { "201": jsonResponse("Registered", { $ref: "#/components/schemas/AuthResponse" }), ...standardErrors }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"], summary: "Login", requestBody: jsonBody({ $ref: "#/components/schemas/LoginRequest" }),
        responses: { "200": jsonResponse("Authenticated", { $ref: "#/components/schemas/AuthResponse" }), ...standardErrors }
      }
    },
    "/api/auth/google": {
      post: {
        tags: ["Auth"], summary: "Login with Google ID token", requestBody: jsonBody({ type: "object", required: ["idToken"], properties: { idToken: { type: "string" } } }),
        responses: { "200": jsonResponse("Authenticated", { $ref: "#/components/schemas/AuthResponse" }), ...standardErrors }
      }
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"], summary: "Rotate refresh token", requestBody: jsonBody({ $ref: "#/components/schemas/RefreshTokenRequest" }),
        responses: { "200": jsonResponse("Rotated", { $ref: "#/components/schemas/AuthResponse" }), ...standardErrors }
      }
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"], summary: "Revoke current session family", requestBody: jsonBody({ $ref: "#/components/schemas/RefreshTokenRequest" }),
        responses: { "204": jsonResponse("Logged out"), ...standardErrors }
      }
    },
    "/api/auth/logout-all": {
      post: { tags: ["Auth"], summary: "Revoke all sessions", security: bearer, responses: { "204": jsonResponse("Logged out"), ...standardErrors } }
    },
    "/api/auth/password-reset/request": {
      post: {
        tags: ["Auth"], summary: "Request password reset", requestBody: jsonBody({ type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } }),
        responses: { "202": jsonResponse("Accepted"), ...standardErrors }
      }
    },
    "/api/auth/password-reset/confirm": {
      post: {
        tags: ["Auth"], summary: "Set a new password", requestBody: jsonBody({ $ref: "#/components/schemas/ActionTokenPasswordRequest" }),
        responses: { "204": jsonResponse("Password changed"), ...standardErrors }
      }
    },
    "/api/auth/email-verification/request": {
      post: { tags: ["Auth"], summary: "Request verification e-mail", security: bearer, responses: { "202": jsonResponse("Accepted"), ...standardErrors } }
    },
    "/api/auth/email-verification/confirm": {
      post: {
        tags: ["Auth"], summary: "Confirm e-mail", requestBody: jsonBody({ type: "object", required: ["token"], properties: { token: { type: "string" } } }),
        responses: { "204": jsonResponse("Verified"), ...standardErrors }
      }
    },
    "/api/users/me": {
      get: { tags: ["Users"], summary: "Get user profile", security: bearer, responses: { "200": jsonResponse("Profile", { $ref: "#/components/schemas/ProfileEnvelope" }), ...standardErrors } },
      patch: {
        tags: ["Users"], summary: "Update user profile", security: bearer,
        requestBody: jsonBody({ type: "object", properties: { fullName: { type: "string" }, phone: { type: "string" }, birthDate: { type: "string", format: "date", nullable: true } } }),
        responses: { "200": jsonResponse("Profile", { $ref: "#/components/schemas/ProfileEnvelope" }), ...standardErrors }
      }
    },
    "/api/clinics/me": {
      get: { tags: ["Clinics"], summary: "Get clinic profile", security: bearer, responses: { "200": jsonResponse("Profile", { $ref: "#/components/schemas/ProfileEnvelope" }), ...standardErrors } },
      patch: {
        tags: ["Clinics"], summary: "Update clinic profile", security: bearer,
        requestBody: jsonBody({ type: "object", properties: { clinicName: { type: "string" }, phone: { type: "string" } } }),
        responses: { "200": jsonResponse("Profile", { $ref: "#/components/schemas/ProfileEnvelope" }), ...standardErrors }
      }
    },
    "/api/pets": {
      get: { tags: ["Pets"], summary: "List own pets", security: bearer, responses: { "200": jsonResponse("Pets", { type: "object", properties: { pets: { type: "array", items: { $ref: "#/components/schemas/Pet" } } } }), ...standardErrors } },
      post: {
        tags: ["Pets"], summary: "Create pet", security: bearer, requestBody: jsonBody({ $ref: "#/components/schemas/PetInput" }),
        responses: { "201": jsonResponse("Created", { $ref: "#/components/schemas/PetEnvelope" }), ...standardErrors }
      }
    },
    "/api/pets/{petId}": {
      parameters: [idParameter("petId")],
      get: { tags: ["Pets"], summary: "Get own pet", security: bearer, responses: { "200": jsonResponse("Pet", { $ref: "#/components/schemas/PetEnvelope" }), ...standardErrors } },
      patch: { tags: ["Pets"], summary: "Update own pet", security: bearer, requestBody: jsonBody({ $ref: "#/components/schemas/PetUpdateInput" }), responses: { "200": jsonResponse("Pet", { $ref: "#/components/schemas/PetEnvelope" }), ...standardErrors } },
      delete: { tags: ["Pets"], summary: "Delete own pet", security: bearer, responses: { "204": jsonResponse("Deleted"), ...standardErrors } }
    },
    "/api/uploads/pet-photo": {
      post: {
        tags: ["Uploads"], summary: "Create signed pet photo upload", security: bearer,
        requestBody: jsonBody({ type: "object", required: ["contentType", "sizeBytes"], properties: { contentType: { type: "string", enum: ["image/jpeg", "image/png", "image/webp"] }, sizeBytes: { type: "integer", minimum: 1, maximum: 10000000 } } }),
        responses: { "201": jsonResponse("Signed upload; PUT must use the declared Content-Type and Content-Length", { $ref: "#/components/schemas/UploadResponse" }), "413": jsonResponse("Photo too large", { $ref: "#/components/schemas/Error" }), "503": { $ref: "#/components/responses/StorageUnavailable" }, ...standardErrors }
      }
    },
    "/api/sitters": {
      get: {
        tags: ["Sitters"], summary: "Search active sitters",
        parameters: [
          { name: "latitude", in: "query", required: true, schema: { type: "number" } },
          { name: "longitude", in: "query", required: true, schema: { type: "number" } },
          { name: "radiusKm", in: "query", schema: { type: "number", default: 25 } },
          { name: "serviceType", in: "query", schema: { $ref: "#/components/schemas/ServiceType" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20, maximum: 50 } }
        ],
        responses: { "200": jsonResponse("Results", { $ref: "#/components/schemas/PaginatedSitters" }), ...standardErrors }
      }
    },
    "/api/sitters/me": {
      post: { tags: ["Sitters"], summary: "Become a sitter", security: bearer, requestBody: jsonBody({ $ref: "#/components/schemas/SitterProfileInput" }), responses: { "201": jsonResponse("Created", { $ref: "#/components/schemas/ProfileEnvelope" }), ...standardErrors } },
      get: { tags: ["Sitters"], summary: "Get own sitter profile", security: bearer, responses: { "200": jsonResponse("Profile", { $ref: "#/components/schemas/ProfileEnvelope" }), ...standardErrors } },
      patch: { tags: ["Sitters"], summary: "Update own sitter profile and services", security: bearer, requestBody: jsonBody({ $ref: "#/components/schemas/SitterProfileInput" }), responses: { "200": jsonResponse("Profile", { $ref: "#/components/schemas/ProfileEnvelope" }), ...standardErrors } }
    },
    "/api/sitters/me/availability": {
      post: {
        tags: ["Sitters"], summary: "Add availability", security: bearer,
        requestBody: jsonBody({ type: "object", required: ["startsAt", "endsAt"], properties: { startsAt: { type: "string", format: "date-time" }, endsAt: { type: "string", format: "date-time" } } }),
        responses: { "201": jsonResponse("Created"), ...standardErrors }
      }
    },
    "/api/sitters/me/availability/{slotId}": {
      delete: { tags: ["Sitters"], summary: "Delete unbooked availability", security: bearer, parameters: [idParameter("slotId")], responses: { "204": jsonResponse("Deleted"), ...standardErrors } }
    },
    "/api/bookings": {
      post: { tags: ["Bookings"], summary: "Request booking", security: bearer, requestBody: jsonBody({ $ref: "#/components/schemas/BookingRequest" }), responses: { "201": jsonResponse("Created", { $ref: "#/components/schemas/BookingEnvelope" }), ...standardErrors } },
      get: {
        tags: ["Bookings"], summary: "List participant bookings", security: bearer,
        parameters: [
          { name: "perspective", in: "query", schema: { type: "string", enum: ["owner", "sitter", "all"], default: "all" } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/BookingStatus" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20, maximum: 50 } }
        ],
        responses: { "200": jsonResponse("Bookings", { $ref: "#/components/schemas/PaginatedBookings" }), ...standardErrors }
      }
    },
    "/api/bookings/{bookingId}": {
      get: { tags: ["Bookings"], summary: "Get participant booking", security: bearer, parameters: [idParameter("bookingId")], responses: { "200": jsonResponse("Booking", { $ref: "#/components/schemas/BookingEnvelope" }), ...standardErrors } }
    },
    "/api/bookings/{bookingId}/status": {
      patch: {
        tags: ["Bookings"], summary: "Accept, reject, cancel or complete booking", security: bearer, parameters: [idParameter("bookingId")],
        requestBody: jsonBody({ type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED"] } } }),
        responses: { "200": jsonResponse("Updated", { $ref: "#/components/schemas/BookingEnvelope" }), ...standardErrors }
      }
    },
    "/api/notifications": {
      get: {
        tags: ["Notifications"], summary: "List own notifications", security: bearer,
        parameters: [
          { name: "unreadOnly", in: "query", schema: { type: "boolean" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20, maximum: 50 } }
        ],
        responses: { "200": jsonResponse("Notifications", { $ref: "#/components/schemas/PaginatedNotifications" }), ...standardErrors }
      }
    },
    "/api/notifications/unread-count": {
      get: { tags: ["Notifications"], summary: "Unread count", security: bearer, responses: { "200": jsonResponse("Count", { type: "object", properties: { count: { type: "integer" } } }), ...standardErrors } }
    },
    "/api/notifications/{notificationId}/read": {
      patch: { tags: ["Notifications"], summary: "Mark one notification read", security: bearer, parameters: [idParameter("notificationId")], responses: { "204": jsonResponse("Read"), ...standardErrors } }
    },
    "/api/notifications/read-all": {
      post: { tags: ["Notifications"], summary: "Mark all notifications read", security: bearer, responses: { "200": jsonResponse("Updated count"), ...standardErrors } }
    }
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    responses: {
      ValidationError: jsonResponse("Invalid request", { $ref: "#/components/schemas/Error" }),
      Unauthorized: jsonResponse("Authentication required", { $ref: "#/components/schemas/Error" }),
      Forbidden: jsonResponse("Forbidden", { $ref: "#/components/schemas/Error" }),
      NotFound: jsonResponse("Not found", { $ref: "#/components/schemas/Error" }),
      Conflict: jsonResponse("Conflict", { $ref: "#/components/schemas/Error" }),
      RateLimited: jsonResponse("Rate limited", { $ref: "#/components/schemas/Error" }),
      InternalError: jsonResponse("Internal error", { $ref: "#/components/schemas/Error" }),
      StorageUnavailable: jsonResponse("Object storage unavailable", { $ref: "#/components/schemas/Error" })
    },
    schemas: {
      Error: { type: "object", required: ["error", "message"], properties: { error: { type: "string" }, message: { type: "string" }, requestId: { type: "string" }, details: { type: "object", additionalProperties: true } } },
      Status: { type: "object", required: ["status"], properties: { status: { type: "string" } } },
      RegisterUserRequest: { type: "object", required: ["fullName", "email", "phone", "password", "confirmPassword"], properties: { fullName: { type: "string" }, email: { type: "string", format: "email" }, phone: { type: "string" }, birthDate: { type: "string", format: "date" }, password: { type: "string", format: "password" }, confirmPassword: { type: "string", format: "password" } } },
      RegisterClinicRequest: { type: "object", required: ["clinicName", "nip", "email", "phone", "password", "confirmPassword"], properties: { clinicName: { type: "string" }, nip: { type: "string" }, email: { type: "string", format: "email" }, phone: { type: "string" }, password: { type: "string", format: "password" }, confirmPassword: { type: "string", format: "password" } } },
      LoginRequest: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } },
      RefreshTokenRequest: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } },
      ActionTokenPasswordRequest: { type: "object", required: ["token", "password", "confirmPassword"], properties: { token: { type: "string" }, password: { type: "string", format: "password" }, confirmPassword: { type: "string", format: "password" } } },
      AuthResponse: { type: "object", required: ["accessToken", "refreshToken", "account"], properties: { accessToken: { type: "string" }, refreshToken: { type: "string" }, account: { type: "object", additionalProperties: true } } },
      ProfileEnvelope: { type: "object", required: ["profile"], properties: { profile: { type: "object", additionalProperties: true } } },
      PetInput: { type: "object", required: ["name", "gender"], properties: { name: { type: "string" }, age: { type: "integer" }, breed: { type: "string" }, weight: { type: "number" }, gender: { type: "string", enum: ["MALE", "FEMALE"] }, photoKey: { type: "string" }, illnesses: { type: "string" }, allergies: { type: "string" }, vaccines: { type: "string" }, vet: { type: "string" }, notes: { type: "string" } } },
      PetUpdateInput: { type: "object", minProperties: 1, properties: { name: { type: "string" }, age: { type: "integer" }, breed: { type: "string" }, weight: { type: "number" }, gender: { type: "string", enum: ["MALE", "FEMALE"] }, photoKey: { type: "string" }, illnesses: { type: "string" }, allergies: { type: "string" }, vaccines: { type: "string" }, vet: { type: "string" }, notes: { type: "string" } } },
      Pet: { allOf: [{ $ref: "#/components/schemas/PetInput" }, { type: "object", required: ["id", "accountId", "createdAt", "updatedAt"], properties: { id: { type: "string" }, accountId: { type: "string" }, photoUrl: { type: "string", format: "uri", nullable: true }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } }] },
      PetEnvelope: { type: "object", required: ["pet"], properties: { pet: { $ref: "#/components/schemas/Pet" } } },
      UploadResponse: { type: "object", required: ["uploadUrl", "photoKey", "expiresIn"], properties: { uploadUrl: { type: "string", format: "uri" }, photoKey: { type: "string" }, expiresIn: { type: "integer" } } },
      ServiceType: { type: "string", enum: ["DOG_WALK", "DROP_IN", "DAY_CARE"] },
      SitterServiceInput: { type: "object", required: ["type", "durationMinutes", "priceCents"], properties: { type: { $ref: "#/components/schemas/ServiceType" }, durationMinutes: { type: "integer", minimum: 15 }, priceCents: { type: "integer", minimum: 0 }, isActive: { type: "boolean" } } },
      SitterProfileInput: { type: "object", properties: { bio: { type: "string" }, city: { type: "string" }, latitude: { type: "number" }, longitude: { type: "number" }, serviceRadiusKm: { type: "integer" }, isActive: { type: "boolean" }, services: { type: "array", items: { $ref: "#/components/schemas/SitterServiceInput" } } } },
      SitterService: { allOf: [{ $ref: "#/components/schemas/SitterServiceInput" }, { type: "object", required: ["id", "currency"], properties: { id: { type: "string" }, sitterProfileId: { type: "string" }, currency: { type: "string", enum: ["PLN"] } } }] },
      AvailabilitySlot: { type: "object", required: ["id", "startsAt", "endsAt"], properties: { id: { type: "string" }, sitterProfileId: { type: "string" }, startsAt: { type: "string", format: "date-time" }, endsAt: { type: "string", format: "date-time" } } },
      SitterSearchItem: { type: "object", required: ["id", "displayName", "bio", "city", "distanceKm", "services", "availability"], properties: { id: { type: "string" }, displayName: { type: "string" }, bio: { type: "string" }, city: { type: "string" }, serviceRadiusKm: { type: "integer" }, distanceKm: { type: "number" }, services: { type: "array", items: { $ref: "#/components/schemas/SitterService" } }, availability: { type: "array", description: "Future, currently unbooked slots. Exact sitter coordinates are intentionally omitted.", items: { $ref: "#/components/schemas/AvailabilitySlot" } } } },
      PaginatedSitters: { type: "object", required: ["items", "pagination"], properties: { items: { type: "array", items: { $ref: "#/components/schemas/SitterSearchItem" } }, pagination: { $ref: "#/components/schemas/Pagination" } } },
      BookingStatus: { type: "string", enum: ["REQUESTED", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED"] },
      BookingRequest: { type: "object", required: ["petId", "sitterServiceId", "availabilitySlotId"], properties: { petId: { type: "string" }, sitterServiceId: { type: "string" }, availabilitySlotId: { type: "string" }, note: { type: "string" } } },
      Booking: { type: "object", required: ["id", "status", "priceCents", "currency"], properties: { id: { type: "string" }, status: { $ref: "#/components/schemas/BookingStatus" }, priceCents: { type: "integer" }, currency: { type: "string", enum: ["PLN"] }, note: { type: "string", nullable: true }, pet: { type: "object", additionalProperties: true }, sitterService: { type: "object", additionalProperties: true }, availabilitySlot: { type: "object", additionalProperties: true } } },
      BookingEnvelope: { type: "object", required: ["booking"], properties: { booking: { $ref: "#/components/schemas/Booking" } } },
      PaginatedBookings: { type: "object", required: ["items", "pagination"], properties: { items: { type: "array", items: { $ref: "#/components/schemas/Booking" } }, pagination: { $ref: "#/components/schemas/Pagination" } } },
      Notification: { type: "object", required: ["id", "type", "title", "message", "createdAt"], properties: { id: { type: "string" }, bookingId: { type: "string", nullable: true }, type: { type: "string" }, title: { type: "string" }, message: { type: "string" }, readAt: { type: "string", format: "date-time", nullable: true }, createdAt: { type: "string", format: "date-time" } } },
      PaginatedNotifications: { type: "object", required: ["items", "pagination"], properties: { items: { type: "array", items: { $ref: "#/components/schemas/Notification" } }, pagination: { $ref: "#/components/schemas/Pagination" } } },
      Pagination: { type: "object", required: ["page", "pageSize", "total"], properties: { page: { type: "integer" }, pageSize: { type: "integer" }, total: { type: "integer" } } }
    }
  }
} as const;
