import { usePetsContext } from "@/features/pets/PetsContext";
import { ApiError } from "@/services/api-client";
import { getAccessToken } from "@/services/auth-storage";
import { createLocalPet, loadLocalPets, updateLocalPet } from "@/services/local-pets-storage";
import { createPet, getPet, updatePet } from "@/services/pets-service";
import { CreatePetPayload, Pet, PetGender } from "@/types/pets";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

export type PetForm = {
  photoUrl: string;
  name: string;
  age: string;
  breed: string;
  weight: string;
  gender: PetGender | "";
  illnesses: string;
  allergies: string;
  vaccines: string;
  vet: string;
  notes: string;
};

export type PetDocument = {
  id: string;
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
};

type PetFormField = keyof PetForm;
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export const initialPetForm: PetForm = {
  photoUrl: "",
  name: "",
  age: "",
  breed: "",
  weight: "",
  gender: "",
  illnesses: "",
  allergies: "",
  vaccines: "",
  vet: "",
  notes: ""
};

export const genderOptions: { value: PetGender; label: string; icon: IconName }[] = [
  { value: "MALE", label: "Samiec", icon: "gender-male" },
  { value: "FEMALE", label: "Samica", icon: "gender-female" }
];

const optionalText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseOptionalInt = (value: string) => {
  const parsed = parseOptionalNumber(value);
  if (parsed === undefined || parsed === null) return parsed;
  return Number.isInteger(parsed) ? parsed : null;
};

function buildPetPayload(form: PetForm): { payload?: CreatePetPayload; error?: string } {
  if (!form.name.trim()) {
    return { error: "Imie jest wymagane" };
  }

  if (!form.gender) {
    return { error: "Wybierz plec zwierzaka" };
  }

  const age = parseOptionalInt(form.age);
  if (age === null) {
    return { error: "Wiek musi byc liczba calkowita" };
  }

  const weight = parseOptionalNumber(form.weight);
  if (weight === null) {
    return { error: "Waga musi byc liczba" };
  }

  return {
    payload: {
      name: form.name.trim(),
      gender: form.gender,
      age,
      breed: optionalText(form.breed),
      weight,
      photoUrl: optionalText(form.photoUrl),
      illnesses: optionalText(form.illnesses),
      allergies: optionalText(form.allergies),
      vaccines: optionalText(form.vaccines),
      vet: optionalText(form.vet),
      notes: optionalText(form.notes)
    }
  };
}

function mapPetToForm(pet: Pet): PetForm {
  return {
    photoUrl: pet.photoUrl ?? "",
    name: pet.name,
    age: pet.age !== null ? String(pet.age) : "",
    breed: pet.breed ?? "",
    weight: pet.weight !== null ? String(pet.weight) : "",
    gender: pet.gender,
    illnesses: pet.illnesses ?? "",
    allergies: pet.allergies ?? "",
    vaccines: pet.vaccines ?? "",
    vet: pet.vet ?? "",
    notes: pet.notes ?? ""
  };
}

function usePhotoPicker(setForm: Dispatch<SetStateAction<PetForm>>, setError: (message: string) => void) {
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);

  const pickPhoto = async () => {
    if (isPickingPhoto) return;

    setError("");
    setIsPickingPhoto(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError("Nadaj dostep do zdjec, aby wybrac zdjecie zwierzaka");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setForm((currentForm) => ({
          ...currentForm,
          photoUrl: result.assets[0].uri
        }));
      }
    } catch {
      setError("Nie udalo sie wybrac zdjecia");
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const clearPhoto = () => {
    setForm((currentForm) => ({
      ...currentForm,
      photoUrl: ""
    }));
  };

  return {
    isPickingPhoto,
    pickPhoto,
    clearPhoto
  };
}

function useDocumentPicker(setError: (message: string) => void) {
  const [documents, setDocuments] = useState<PetDocument[]>([]);
  const [isPickingDocument, setIsPickingDocument] = useState(false);

  const pickDocuments = async () => {
    if (isPickingDocument) return;

    setError("");
    setIsPickingDocument(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: true,
        copyToCacheDirectory: true
      });

      if (!result.canceled) {
        const pickedDocuments: PetDocument[] = result.assets.map((file, index) => ({
          id: `${file.uri}-${Date.now()}-${index}`,
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size
        }));

        setDocuments((currentDocuments) => [...currentDocuments, ...pickedDocuments]);
      }
    } catch {
      setError("Nie udalo sie wybrac pliku PDF");
    } finally {
      setIsPickingDocument(false);
    }
  };

  const removeDocument = (documentId: string) => {
    setDocuments((currentDocuments) => currentDocuments.filter((document) => document.id !== documentId));
  };

  const clearDocuments = () => {
    setDocuments([]);
  };

  return {
    documents,
    isPickingDocument,
    pickDocuments,
    removeDocument,
    clearDocuments
  };
}

export function useCreatePetForm(onSuccess?: () => void) {
  const { addPet } = usePetsContext();
  const [form, setForm] = useState<PetForm>(initialPetForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isPickingPhoto, pickPhoto, clearPhoto } = usePhotoPicker(setForm, setError);
  const { documents, isPickingDocument, pickDocuments, removeDocument, clearDocuments } = useDocumentPicker(setError);

  const updateField = (field: PetFormField, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (isSubmitting) return;

    setError("");
    setSuccess("");

    const result = buildPetPayload(form);
    if (!result.payload) {
      setError(result.error || "Nieprawidlowe dane formularza");
      return;
    }

    const accessToken = await getAccessToken();
    setIsSubmitting(true);

    try {
      if (!accessToken) {
        const pet = createLocalPet(result.payload);
        addPet(pet);
        setSuccess("Zwierzak zostal dodany");
        setForm(initialPetForm);
        clearDocuments();
        onSuccess?.();
        return;
      }

      const response = await createPet(result.payload, accessToken);
      addPet(response.pet);
      setSuccess("Zwierzak zostal dodany");
      setForm(initialPetForm);
      clearDocuments();
      onSuccess?.();
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message || "Nie udalo sie dodac zwierzaka");
      } else {
        setError("Nie udalo sie dodac zwierzaka");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    error,
    success,
    isSubmitting,
    isPickingPhoto,
    documents,
    isPickingDocument,
    updateField,
    pickPhoto,
    clearPhoto,
    pickDocuments,
    removeDocument,
    handleSave
  };
}

export function useEditPetForm(petId?: string, onSaveSuccess?: () => void) {
  const { updatePetInList } = usePetsContext();
  const [form, setForm] = useState<PetForm>(initialPetForm);
  const savedFormRef = useRef<PetForm>(initialPetForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isPickingPhoto, pickPhoto, clearPhoto } = usePhotoPicker(setForm, setError);
  const { documents, isPickingDocument, pickDocuments, removeDocument } = useDocumentPicker(setError);

  const applyLoadedForm = (nextForm: PetForm) => {
    savedFormRef.current = nextForm;
    setForm(nextForm);
  };

  const revertChanges = () => {
    setForm(savedFormRef.current);
    setError("");
    setSuccess("");
  };

  const updateField = (field: PetFormField, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  };

  useEffect(() => {
    let isMounted = true;

    const loadPet = async () => {
      if (!petId) {
        setError("Nie znaleziono zwierzaka");
        setIsLoading(false);
        return;
      }

      try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
          const localPets = await loadLocalPets();
          const pet = localPets.find((item) => item.id === petId);

          if (isMounted) {
            if (pet) {
              applyLoadedForm(mapPetToForm(pet));
            } else {
              setError("Nie znaleziono zwierzaka");
            }
          }

          return;
        }

        const response = await getPet(petId, accessToken);
        if (isMounted) {
          applyLoadedForm(mapPetToForm(response.pet));
        }
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          setError(requestError.message || "Nie udalo sie pobrac profilu");
        } else {
          setError("Nie udalo sie pobrac profilu");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPet();

    return () => {
      isMounted = false;
    };
  }, [petId]);

  const handleSave = async () => {
    if (isSubmitting) return;

    setError("");
    setSuccess("");

    if (!petId) {
      setError("Nie znaleziono zwierzaka");
      return;
    }

    const result = buildPetPayload(form);
    if (!result.payload) {
      setError(result.error || "Nieprawidlowe dane formularza");
      return;
    }

    const accessToken = await getAccessToken();
    setIsSubmitting(true);

    try {
      if (!accessToken) {
        const localPets = await loadLocalPets();
        const existingPet = localPets.find((item) => item.id === petId);

        if (!existingPet) {
          setError("Nie znaleziono zwierzaka");
          return;
        }

        const updatedPet = updateLocalPet(existingPet, result.payload);
        updatePetInList(updatedPet);
        applyLoadedForm(mapPetToForm(updatedPet));
        setSuccess("Zapisano zmiany");
        onSaveSuccess?.();
        return;
      }

      const response = await updatePet(petId, result.payload, accessToken);
      updatePetInList(response.pet);
      applyLoadedForm(mapPetToForm(response.pet));
      setSuccess("Zapisano zmiany");
      onSaveSuccess?.();
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message || "Nie udalo sie zapisac zmian");
      } else {
        setError("Nie udalo sie zapisac zmian");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    error,
    success,
    isSubmitting,
    isLoading,
    isPickingPhoto,
    documents,
    isPickingDocument,
    updateField,
    pickPhoto,
    clearPhoto,
    pickDocuments,
    removeDocument,
    handleSave,
    revertChanges
  };
}
