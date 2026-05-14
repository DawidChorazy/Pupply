export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Pupply Backend API",
    version: "1.0.0",
    description: "API for authentication and user profile endpoints."
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local development"
    }
  ],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Users" },
    { name: "Pets" }
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/register/user": {
      post: {
        tags: ["Auth"],
        summary: "Register user account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterUserRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "User created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" }
              }
            }
          }
        }
      }
    },
    "/api/auth/register/clinic": {
      post: {
        tags: ["Auth"],
        summary: "Register clinic account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterClinicRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Clinic account created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" }
              }
            }
          }
        }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Authentication successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" }
              }
            }
          }
        }
      }
    },
    "/api/auth/google": {
      post: {
        tags: ["Auth"],
        summary: "Login with Google",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GoogleLoginRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Authentication successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" }
              }
            }
          }
        }
      }
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh session",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: {
                  refreshToken: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Session refreshed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" }
              }
            }
          }
        }
      }
    },
    "/api/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get current user profile",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "User profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    profile: { $ref: "#/components/schemas/UserProfileResponse" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/pets": {
      get: {
        tags: ["Pets"],
        summary: "List pets",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Pets list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PetsResponse" }
              }
            }
          }
        }
      },
      post: {
        tags: ["Pets"],
        summary: "Create pet",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePetRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Pet created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    pet: { $ref: "#/components/schemas/PetResponse" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/pets/{petId}": {
      get: {
        tags: ["Pets"],
        summary: "Get pet",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "petId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Pet",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    pet: { $ref: "#/components/schemas/PetResponse" }
                  }
                }
              }
            }
          }
        }
      },
      patch: {
        tags: ["Pets"],
        summary: "Update pet",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "petId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdatePetRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Pet updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    pet: { $ref: "#/components/schemas/PetResponse" }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      RegisterUserRequest: {
        type: "object",
        required: ["fullName", "email", "phone", "password", "confirmPassword"],
        properties: {
          fullName: { type: "string", example: "Jan Kowalski" },
          email: { type: "string", format: "email", example: "jan@example.com" },
          phone: { type: "string", example: "+48123456789" },
          birthDate: { type: "string", format: "date", example: "2002-02-02" },
          password: { type: "string", example: "Test@1234" },
          confirmPassword: { type: "string", example: "Test@1234" }
        }
      },
      RegisterClinicRequest: {
        type: "object",
        required: ["clinicName", "nip", "email", "phone", "password", "confirmPassword"],
        properties: {
          clinicName: { type: "string", example: "Happy Paws Clinic" },
          nip: { type: "string", example: "1234567890" },
          email: { type: "string", format: "email", example: "clinic@example.com" },
          phone: { type: "string", example: "+48111222333" },
          password: { type: "string", example: "Test@1234" },
          confirmPassword: { type: "string", example: "Test@1234" }
        }
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "jan@example.com" },
          password: { type: "string", example: "Test@1234" }
        }
      },
      GoogleLoginRequest: {
        type: "object",
        required: ["idToken"],
        properties: {
          idToken: { type: "string" }
        }
      },
      AuthResponse: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
          account: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              role: { type: "string", enum: ["USER", "CLINIC"] },
              profile: { type: "object", nullable: true }
            }
          }
        }
      },
      UserProfileResponse: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          fullName: { type: "string" },
          phone: { type: "string" },
          birthDate: { type: "string", format: "date-time", nullable: true }
        }
      },
      PetGender: {
        type: "string",
        enum: ["MALE", "FEMALE"]
      },
      PetsResponse: {
        type: "object",
        properties: {
          pets: {
            type: "array",
            items: { $ref: "#/components/schemas/PetResponse" }
          }
        }
      },
      CreatePetRequest: {
        type: "object",
        required: ["name", "gender"],
        properties: {
          name: { type: "string", example: "Luna" },
          age: { type: "integer", example: 4, nullable: true },
          breed: { type: "string", example: "Labrador", nullable: true },
          weight: { type: "number", example: 22.5, nullable: true },
          gender: { $ref: "#/components/schemas/PetGender" },
          photoUrl: { type: "string", example: "https://example.com/dog.jpg", nullable: true },
          illnesses: { type: "string", nullable: true },
          allergies: { type: "string", nullable: true },
          vaccines: { type: "string", nullable: true },
          vet: { type: "string", nullable: true },
          notes: { type: "string", nullable: true }
        }
      },
      UpdatePetRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer", nullable: true },
          breed: { type: "string", nullable: true },
          weight: { type: "number", nullable: true },
          gender: { $ref: "#/components/schemas/PetGender" },
          photoUrl: { type: "string", nullable: true },
          illnesses: { type: "string", nullable: true },
          allergies: { type: "string", nullable: true },
          vaccines: { type: "string", nullable: true },
          vet: { type: "string", nullable: true },
          notes: { type: "string", nullable: true }
        }
      },
      PetResponse: {
        type: "object",
        properties: {
          id: { type: "string" },
          accountId: { type: "string" },
          name: { type: "string" },
          age: { type: "integer", nullable: true },
          breed: { type: "string", nullable: true },
          weight: { type: "number", nullable: true },
          gender: { $ref: "#/components/schemas/PetGender" },
          photoUrl: { type: "string", nullable: true },
          illnesses: { type: "string", nullable: true },
          allergies: { type: "string", nullable: true },
          vaccines: { type: "string", nullable: true },
          vet: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      }
    }
  }
} as const;
