module.exports = function safeJsonParse(text){

  try{

    if(!text) return null;

    const clean = text
      .replace(/```json/g,"")
      .replace(/```/g,"")
      .trim();

    return JSON.parse(clean);

  }catch{

    return { raw:text };

  }

};