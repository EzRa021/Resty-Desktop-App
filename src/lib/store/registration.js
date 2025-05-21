import { create } from "zustand"

export const useRegistrationStore = create((set, get) => ({
  // Current step in the registration process
  step: 1,

  // Restaurant data
  restaurant: {
    name: "",
    isBranchMultiple: false,
    contact: {
      phone: "",
      email: "",
    },
    logo: null,
  },

  // Branch data (array to support multiple branches)
  branches: [
    {
      name: "",
      location: {
        address: "",
      },
      contact: {
        phone: "",
        email: "",
      },
    },
  ],

  // User data
  user: {
    name: "",
    email: "",
    password: "",
    phone: "",
  },

  // Socket instance
  socket: null,

  // Form validation states
  restaurantFormValid: false,
  branchFormValid: false,
  userFormValid: false,

  // Form errors
  errors: {
    restaurant: {},
    branch: {},
    user: {},
  },

  // Computed property to check if registration is complete
  isComplete: false,

  // Actions
  setStep: (step) => set({ step }),

  nextStep: () => set((state) => ({ step: Math.min(state.step + 1, 3) })),

  prevStep: () => set((state) => ({ step: Math.max(state.step - 1, 1) })),

  setRestaurant: (data) =>
    set((state) => ({
      restaurant: { ...state.restaurant, ...data },
    })),

  setRestaurantContact: (data) =>
    set((state) => ({
      restaurant: {
        ...state.restaurant,
        contact: { ...state.restaurant.contact, ...data },
      },
    })),

  setBranch: (index, data) =>
    set((state) => {
      const newBranches = [...state.branches]
      newBranches[index] = { ...newBranches[index], ...data }
      return { branches: newBranches }
    }),

  setBranchContact: (index, data) =>
    set((state) => {
      const newBranches = [...state.branches]
      if (newBranches[index]) {
        newBranches[index] = {
          ...newBranches[index],
          contact: { ...newBranches[index].contact, ...data },
        }
      }
      return { branches: newBranches }
    }),

  setBranchLocation: (index, data) =>
    set((state) => {
      const newBranches = [...state.branches]
      if (newBranches[index]) {
        newBranches[index] = {
          ...newBranches[index],
          location: { ...newBranches[index].location, ...data },
        }
      }
      return { branches: newBranches }
    }),

  addBranch: () =>
    set((state) => ({
      branches: [
        ...state.branches,
        {
          name: "",
          location: {
            address: "",
          },
          contact: {
            phone: "",
            email: "",
          },
        },
      ],
    })),

  removeBranch: (index) =>
    set((state) => {
      if (state.branches.length <= 1) return state
      const newBranches = [...state.branches]
      newBranches.splice(index, 1)
      return { branches: newBranches }
    }),

  setUser: (data) =>
    set((state) => ({
      user: { ...state.user, ...data },
    })),

  setRestaurantFormValid: (valid) => set({ restaurantFormValid: valid }),

  setBranchFormValid: (valid) => set({ branchFormValid: valid }),

  setUserFormValid: (valid) => set({ userFormValid: valid }),

  setErrors: (type, errors) =>
    set((state) => ({
      errors: { ...state.errors, [type]: errors },
    })),

  setSocket: (socket) => set({ socket }),

  resetRegistration: () =>
    set({
      step: 1,
      restaurant: {
        name: "",
        isBranchMultiple: false,
        contact: {
          phone: "",
          email: "",
        },
        logo: null,
      },
      branches: [
        {
          name: "",
          location: {
            address: "",
          },
          contact: {
            phone: "",
            email: "",
          },
        },
      ],
      user: {
        name: "",
        email: "",
        password: "",
        phone: "",
      },
      restaurantFormValid: false,
      branchFormValid: false,
      userFormValid: false,
      errors: {
        restaurant: {},
        branch: {},
        user: {},
      },
    }),

  updateIsComplete: () =>
    set((state) => ({
      isComplete: state.restaurantFormValid && state.branchFormValid && state.userFormValid,
    })),
}))
