import ApiService from "../../services/api";

const useLogs = () => {
  const createLog = async ({ action, user, role, entity, status }) => {
    try {
      let payload = {
        type: "add",
        user,
        action,
        role,
        entity,
        status,
      };

      const res = await ApiService(payload, "logs");
      return res;
    } catch (error) {
      console.error(error);
      return error;
    }
  };

  return { createLog };
};

export default useLogs;
