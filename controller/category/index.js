const categoryService = require("./service");

const getCategories = async (req,res) => {
  try {
    const result = await categoryService.getCategoriesService(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const createCategory = async (req,res) => {
  try {
    const result = await categoryService.createCategoryService(req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const updateCategory = async (req,res) => {
  try {
    const result = await categoryService.updateCategoryService(req.params.id, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const deleteCategory = async (req,res) => {
  try {
    const result = await categoryService.deleteCategoryService(req.params.id);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const getSkills = async (req,res) => {
  try {
    const result = await categoryService.getSkillsService(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const createSkill = async (req,res) => {
  try {
    const result = await categoryService.createSkillService(req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const updateSkill = async (req,res) => {
  try {
    const result = await categoryService.updateSkillService(req.params.id, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const deleteSkill = async (req,res) => {
  try {
    const result = await categoryService.deleteSkillService(req.params.id);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const getCategorySkills = async (req,res) => {
  try {
    const result = await categoryService.getCategorySkillsService(req.params.categoryId);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const addSkillToCategory = async (req,res) => {
  try {
    const result = await categoryService.addSkillToCategoryService(req.params.categoryId, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const removeSkillFromCategory = async (req,res) => {
  try {
    const result = await categoryService.removeSkillFromCategoryService(req.params.categoryId, req.params.skillId);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  getCategorySkills,
  addSkillToCategory,
  removeSkillFromCategory,
};
