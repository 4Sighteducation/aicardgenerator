const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_KEY,
});

// Exam type complexity levels to guide content difficulty
const examComplexityGuidance = {
  "A-Level": "Focus on in-depth specialized knowledge with emphasis on critical analysis, evaluation and application. Include detailed technical terminology and expect students to demonstrate independent thinking.",
  "GCSE": "Cover foundational knowledge with clear explanations of key concepts. Focus on comprehension and basic application rather than complex analysis. Ensure terminology is appropriate for a broad introduction to the subject.",
  "BTEC": "Focus on practical applications, industry standards, and vocational context.",
  "IB": "Similar to A-Level with critical thinking and application focus, but slightly broader in scope as students take six subjects. Include appropriate technical terminology while balancing depth with the wider curriculum demands."
};

// Standard examples for each card type to improve consistency
const cardExamples = {
  multiple_choice: {
    Biology: {
      question: "Which organelle is primarily responsible for ATP production in eukaryotic cells?",
      options: ["Mitochondria", "Nucleus", "Golgi apparatus", "Lysosome"],
      correctAnswer: "Mitochondria",
      detailedAnswer: "Mitochondria are the powerhouses of the cell where cellular respiration occurs, converting glucose and oxygen into ATP through processes including the Krebs cycle and electron transport chain."
    }
  },
  short_answer: {
    Chemistry: {
      question: "Explain how the rate of reaction is affected by increasing temperature.",
      keyPoints: [
        "Particles gain more kinetic energy",
        "More frequent collisions occur",
        "More collisions exceed the activation energy",
        "Rate of successful collisions increases"
      ],
      detailedAnswer: "When temperature increases, particles gain more kinetic energy, moving faster and colliding more frequently. A greater proportion of these collisions exceed the activation energy required for reaction, resulting in more successful collisions per unit time. This leads to an exponential increase in reaction rate as described by the Arrhenius equation."
    }
  }
};

// New getEssayInstructions function with rotating verb list
function getEssayInstructions({ topic, examBoard, examType, subject, iterationHint = 0, totalCardsInSet = 1 }) {
  const essayCommandVerbs = [
    "Analyse", 
    "Discuss", 
    "To what extent", 
    "Assess", 
    "Compare and contrast",
    "Explain the reasons for",
    "Justify",
    "Argue for or against"
    // 'Evaluate' is initially omitted to force other verbs
  ];

  if (totalCardsInSet === 1) {
    return `For this essay question, select an appropriate command verb from Categories 3 or 4 (e.g., Analyse, Discuss, Assess, To what extent, Evaluate) that best fits the nuance of the question you will formulate about "${topic}".`;
  }

  const verbForThisCard = essayCommandVerbs[iterationHint % essayCommandVerbs.length]; 

  let instruction = `This is card ${iterationHint + 1} of ${totalCardsInSet} for "${topic}".\n`;
  instruction += `GUIDANCE FOR THIS CARD:\n`;
  instruction += `1. For this specific card, you *must* formulate the primary essay question using the command verb: "${verbForThisCard}".\n`;
  instruction += `2. Ensure the question explores a unique facet of "${topic}" that is different from other cards in this set.\n`;
  instruction += `3. Structure your KeyPoints and DetailedAnswer appropriately for a question led by "${verbForThisCard}".`;
  
  if (iterationHint === 0) {
    instruction += `\n   As this is the first card, aim for a question that addresses a fundamental aspect of the topic using "${verbForThisCard}".`;
  } else if (iterationHint === totalCardsInSet - 1) {
    instruction += `\n   As this is the final card, ensure your question using "${verbForThisCard}" provides a distinct concluding perspective or tackles a remaining important angle.`;
  }
  return instruction;
}

function buildPrompt({ subject, topic, examType, examBoard, questionType, numCards, iterationHint = 0, totalCardsInSet = 1 }) {
  const complexityGuidance = examComplexityGuidance[examType] || examComplexityGuidance["GCSE"];
  
  let basePrompt = `Generate ${numCards} high-quality flashcards for ${examBoard} ${examType} ${subject} on "${topic}".
  You are currently generating card number ${iterationHint + 1} of a total set of ${totalCardsInSet} for this specific topic.
  
DIFFICULTY LEVEL: ${complexityGuidance}

SPECIFIC INSTRUCTIONS:
1. Each flashcard must be directly relevant to "${topic}" specifically.
2. Include exam-specific terminology and concepts.
3. Ensure content is appropriate for ${examType} level students.
4. Where possible use questions similar to those found in ${examType} exams for ${examBoard}.
`;

  if (totalCardsInSet > 1) {
    basePrompt += `5. This is card ${iterationHint + 1} of ${totalCardsInSet}. Ensure its question is unique and explores a different facet of the topic compared to other cards in this set (especially if iterationHint > 0).
`;
  }

  if (questionType === "multiple_choice") {
    basePrompt += `
CONTENT GUIDANCE:
- Create challenging yet fair multiple choice questions
- Distribute the correct answer randomly among the four positions
- All four options should be plausible and related to ${topic}
- Provide detailed explanations that would help a student understand the concept
`;
  } 
  else if (questionType === "short_answer") {
    basePrompt += `
CONTENT GUIDANCE:
- Questions should require concise, focused answers
- KeyPoints should list exactly what an examiner would look for (2-4 points)
- DetailedAnswer should provide a comprehensive explanation with examples
`;
  } 
  else if (questionType === "essay") {
    basePrompt += `
CONTENT GUIDANCE:
- ${getEssayInstructions({ topic, examBoard, examType, subject, iterationHint, totalCardsInSet })}
- Each question must be distinct and explore a different facet of the topic.
- KeyPoints should reflect main arguments and essay structure needed for top marks (e.g., intro, para 1, para 2, conclusion).
- Include ${examType}-appropriate evaluation and analysis guidance in the detailed answer.
- DetailedAnswer should provide a comprehensive explanation of how to structure the essay and cover key content points.
`; 
  } 
  else if (questionType === "acronym") {
    basePrompt += `
CONTENT GUIDANCE:
- Question: A clear question asking what the acronym stands for or its relevance.
- Acronym: The acronym itself.
- Explanation: What each letter stands for with detailed explanation of the concept it represents.
`;
  }
  return basePrompt;
}

// Card validation function from improved-flashcard-code.js
function validateCards(cards, params) {
  const { questionType, examType, topic, examBoard } = params;
  
  return cards.map(card => {
    let issues = [];
    if (!card.question || typeof card.question !== 'string' || card.question.trim() === '') {
        issues.push("Question is missing or empty.");
        card.question = "Question generation failed."; 
    } else if (card.question.length < 10 && !card.question.toLowerCase().includes(topic.toLowerCase())) { 
      issues.push("Question too brief or may lack specificity to the topic.");
    }

    card.subject = card.subject || params.subject;
    card.topic = card.topic || params.topic;
    card.questionType = card.questionType || params.questionType;

    if (questionType === "multiple_choice") {
      if (!card.options || !Array.isArray(card.options) || card.options.length !== 4) {
        issues.push("Multiple choice requires exactly 4 options.");
        card.options = ["Option A", "Option B", "Option C", "Option D"]; 
      }
      if (!card.correctAnswer || typeof card.correctAnswer !== 'string' || !card.options.includes(card.correctAnswer)) {
        issues.push("Correct answer must match exactly one of the options.");
        card.correctAnswer = card.options[0]; 
      }
      if (new Set(card.options).size !== card.options.length) {
        issues.push("Multiple choice options must be unique.");
        card.options = [...new Set(card.options)]; 
        while(card.options.length < 4) card.options.push(`Unique Option ${card.options.length + 1}`);
        if (!card.options.includes(card.correctAnswer)) card.correctAnswer = card.options[0];
      }
       if (!card.detailedAnswer || card.detailedAnswer.length < 20) {
         issues.push("Multiple choice detailed answer lacks sufficient explanation.");
         card.detailedAnswer = card.detailedAnswer || "Detailed explanation should be provided here.";
       }
    } else if (questionType === "short_answer") {
      if (!card.keyPoints || !Array.isArray(card.keyPoints) || card.keyPoints.length < 1 || card.keyPoints.length > 5) {
        issues.push("Short answer requires 1-5 key points.");
        card.keyPoints = card.keyPoints || ["Key point 1"];
      }
      if (!card.detailedAnswer || card.detailedAnswer.length < 30) {
        issues.push("Short answer detailed explanation lacks depth.");
        card.detailedAnswer = card.detailedAnswer || "More detailed explanation needed.";
      }
    } else if (questionType === "essay") {
      if (!card.keyPoints || !Array.isArray(card.keyPoints) || card.keyPoints.length < 2) {
        issues.push("Essay requires at least 2 key points for structure.");
        card.keyPoints = card.keyPoints || ["Introduction point", "Main argument point"];
      }
      if (!card.detailedAnswer || card.detailedAnswer.length < 50) {
        issues.push("Essay detailed explanation lacks depth.");
        card.detailedAnswer = card.detailedAnswer || "More detailed explanation and analysis needed.";
      }
    } else if (questionType === "acronym") {
      if (!card.acronym || typeof card.acronym !== 'string' || card.acronym.trim() === '') {
          issues.push("Acronym field is missing or empty.");
          card.acronym = card.acronym || "ACRNYM";
      }
      if (!card.explanation || card.explanation.length < 20) {
        issues.push("Acronym explanation lacks sufficient detail.");
        card.explanation = card.explanation || "Detailed explanation of the acronym and its components.";
      }
    }

    if (examType === "A-Level" || examType === "IB") {
      if (card.detailedAnswer && card.detailedAnswer.length < (questionType === "essay" ? 150 : 100)) { 
        issues.push(`${examType} explanation may lack sufficient depth/analysis.`);
      }
      const evaluationTerms = ["evaluate", "analyze", "compare", "contrast", "assess", "critique", "to what extent", "discuss"];
      if (questionType === "essay" && !evaluationTerms.some(term => 
        (card.question && card.question.toLowerCase().includes(term)) || 
        (card.keyPoints && card.keyPoints.some(point => point.toLowerCase().includes(term))))) {
        issues.push(`${examType} essay question or key points may lack evaluation/analytical focus.`);
      }
    } else if (examType === "GCSE") {
      if (card.detailedAnswer && card.detailedAnswer.length > 400) { 
        issues.push("GCSE explanation may be overly complex for the level.");
      }
    }
    if (card.questionType === "acronym" && card.explanation && !card.detailedAnswer) {
      card.detailedAnswer = card.explanation;
    }
    if (!card.detailedAnswer) {
        if (card.explanation) { 
            card.detailedAnswer = card.explanation;
        } else if (card.keyPoints && Array.isArray(card.keyPoints)) { 
            card.detailedAnswer = card.keyPoints.join("\n");
        } else {
            card.detailedAnswer = "No detailed answer provided."; 
        }
    }
    return { ...card, _validationIssues: issues };
  });
}

// generateCards function based on improved-flashcard-code.js, with integrated fixes
async function generateCards({ subject, topic, examType, examBoard, questionType, numCards, iterationHint = 0, totalCardsInSet = 1 }) {
  const prompt = buildPrompt({ subject, topic, examType, examBoard, questionType, numCards, iterationHint, totalCardsInSet });

  const systemMessage = `You are an expert ${examType} ${subject} educator with extensive experience marking ${examBoard} exams.
  Create flashcards that precisely match actual ${examBoard} exam questions and mark schemes for ${examType} students studying "${topic}".

  Here are categories of command words to guide question formulation:
  Category 1 (Recall & Basic Description): Label, Annotate, List, Define, Describe, Select, State/Relate, Outline, Summarise, Illustrate
  Category 2 (Explanation & Application): Explain, Comment on, Determine, Demonstrate, Identify/Infer, Calculate, Show/Prove/Set out, Verify/Give reasons for/Consider, Translate, Correct
  Category 3 (Analysis & Detailed Examination): Analyse, Examine, Explore, Compare and contrast/Differentiate between/Distinguish between, Review, Investigate, Solve
  Category 4 (Judgement & Justification): Discuss/"To what extent...", Evaluate, Assess, Argue, Justify, Criticise, Suggest/Propose/Make a case for, Predict, Recommend

  IMPORTANT: For essay questions, use a balanced variety of command verbs from Categories 3 & 4. Don't favor or avoid any particular command verb - choose what best fits the specific question being created.

  When generating multiple cards for the same topic, each card's question MUST:
  1. Use a DIFFERENT primary command verb from the others in the set (this will be guided by the specific instruction for the current card iteration if it's an essay).
  2. Explore a DIFFERENT facet of the topic
  3. Be structured uniquely based on the command verb used`;

  const model = "gpt-3.5-turbo"; 

  let cardProperties = {
    subject: { type: "string", description: `The subject: ${subject}` },
    topic: { type: "string", description: `The specific topic: ${topic}` },
    questionType: { type: "string", description: `The type of card: ${questionType}` },
    syllabusReference: { 
      type: "string", 
      description: `Optional: The specific section of the ${examBoard} ${examType} syllabus this question relates to (e.g., "3.4.2 Cellular Respiration"). Leave empty if not directly applicable.`
    },
    question: { type: "string", description: "The primary question for the flashcard front." }
  };
  
  if (questionType === "multiple_choice") {
    cardProperties = {
      ...cardProperties,
      options: { 
        type: "array", 
        items: { type: "string" },
        description: "Exactly four distinct answer options for the question. All options should be plausible."
      },
      correctAnswer: { 
        type: "string", 
        description: "The correct answer, must match exactly one of the provided options."
      },
      detailedAnswer: { 
        type: "string", 
        description: `Thorough explanation of why the correct answer is right and others are wrong, using ${examType}-appropriate terminology that would satisfy ${examBoard} mark scheme requirements.`
      }
    };
  } else if (questionType === "short_answer") {
    cardProperties = {
      ...cardProperties,
      keyPoints: { 
        type: "array", 
        items: { type: "string" },
        description: "2-5 key points that would earn marks in an exam. These are concise bullet points."
      },
      detailedAnswer: { 
        type: "string", 
        description: `A comprehensive explanation expanding on the key points, providing context and examples. This is more narrative than the key points.`
      }
    };
  } else if (questionType === "essay") {
    cardProperties = {
      ...cardProperties,
      keyPoints: { 
        type: "array", 
        items: { type: "string" },
        description: "3-6 key points outlining the essay structure and main arguments (e.g., introduction, main body paragraph arguments, conclusion points). These guide the essay plan."
      },
      detailedAnswer: { 
        type: "string", 
        description: `A detailed explanation of the essay's content, covering the core arguments, evidence, and analysis expected. This is the 'model answer' content.`
      }
    };
  } else if (questionType === "acronym") {
    cardProperties = {
      ...cardProperties,
      acronym: { type: "string", description: "The acronym itself (e.g., 'LASER')." },
      explanation: { 
        type: "string", 
        description: "What each letter in the acronym stands for, followed by a detailed explanation of the concept the acronym represents. This will be used as the detailed answer for the card."
      }
    };
  }
  const baseRequired = ["subject", "topic", "questionType", "question"];
  let currentRequired = [...baseRequired];
  if (questionType === "multiple_choice") currentRequired.push("options", "correctAnswer", "detailedAnswer");
  else if (questionType === "short_answer") currentRequired.push("keyPoints", "detailedAnswer");
  else if (questionType === "essay") currentRequired.push("keyPoints", "detailedAnswer");
  else if (questionType === "acronym") currentRequired.push("acronym", "explanation");

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      functions: [{
        name: "generateFlashcards",
        description: `Generate ${numCards} authentic ${examBoard} ${examType} flashcards for ${subject} on the topic of ${topic}. Each card must conform to the specified properties.`,
        parameters: {
          type: "object",
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: cardProperties,
                required: currentRequired
              }
            }
          },
          required: ["cards"]
        }
      }],
      function_call: { name: "generateFlashcards" },
      max_tokens: Math.min(4000, numCards * 350 + 200), 
      temperature: 0.6, // Adjusted temperature
    });
    
    if (response.choices[0].message.function_call) {
      let functionArgs;
      try {
        functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);
      } catch (parseError) {
        console.error("Error parsing function call arguments from OpenAI:", parseError);
        console.error("Arguments received:", response.choices[0].message.function_call.arguments);
        return JSON.stringify([]); 
      }

      if (functionArgs.error) {
        console.error("OpenAI function call returned an error:", functionArgs.error);
        return JSON.stringify([]); 
      }
      if (functionArgs.cards && Array.isArray(functionArgs.cards)) {
        console.log(`Successfully received ${functionArgs.cards.length} cards from OpenAI function call for iteration ${iterationHint}.`);
        
        const validatedCards = validateCards(functionArgs.cards, { subject, topic, examType, examBoard, questionType });
        
        validatedCards.forEach((card, index) => {
          if (card._validationIssues && card._validationIssues.length > 0) {
            console.warn(`Validation issues for card ${index + 1} (iter ${iterationHint}, '${card.question && card.question.substring(0,30)}...'):`, card._validationIssues);
          }
        });
        
        const cleanCards = validatedCards.map(card => {
          const { _validationIssues, ...cleanCard } = card; 
          return cleanCard;
        });

        console.log(`Returning ${cleanCards.length} validated and cleaned cards for iteration ${iterationHint}.`);
        return JSON.stringify(cleanCards);
      } else {
        console.error("OpenAI function call returned invalid or missing cards array. Args:", functionArgs);
        return JSON.stringify([]); 
      }
    } else {
      console.warn("Function call not used in OpenAI response. Fallback not implemented robustly. Response:", response.choices[0].message);
      const content = response.choices[0].message.content;
      try {
        const parsedContent = JSON.parse(content);
        if (parsedContent && parsedContent.cards && Array.isArray(parsedContent.cards)) {
           console.log(`Successfully parsed ${parsedContent.cards.length} cards from direct content for iteration ${iterationHint}.`);
           const validatedCards = validateCards(parsedContent.cards, { subject, topic, examType, examBoard, questionType });
           const cleanCards = validatedCards.map(card => {
             const { _validationIssues, ...cleanCard } = card;
             return cleanCard;
           });
           return JSON.stringify(cleanCards);
        } else if (Array.isArray(parsedContent)) { 
           console.log(`Successfully parsed ${parsedContent.length} cards directly as array from content for iteration ${iterationHint}.`);
           const validatedCards = validateCards(parsedContent, { subject, topic, examType, examBoard, questionType });
           const cleanCards = validatedCards.map(card => {
             const { _validationIssues, ...cleanCard } = card;
             return cleanCard;
           });
           return JSON.stringify(cleanCards);
        }
        console.error("Fallback content parsing failed to find a 'cards' array or a direct array. Content:", content);
        return JSON.stringify([]);
      } catch (e) {
        console.error("Error parsing fallback content from OpenAI:", e);
        console.error("Content received:", content);
        return JSON.stringify([]); 
      }
    }
  } catch (error) {
    console.error("OpenAI API call error:", error.status, error.message, error.response?.data);
    return JSON.stringify([]);
  }
}

// Caching logic (retained and adapted)
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

async function generateWithRetry(params, maxRetries = 2) { // Reduced default retries
  const cacheKey = `${params.subject}|${params.topic}|${params.examType}|${params.examBoard}|${params.questionType}|${params.numCards}|iter${params.iterationHint || 0}|total${params.totalCardsInSet || params.numCards}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Cache hit for ${cacheKey}`);
      return cached.data; // This should be a string (JSON array or empty array string)
    }
  }

  let retries = 0;
  while (retries < maxRetries) {
    try {
      const resultString = await generateCards(params); // Expects a string (JSON array or empty array string)
      
      // Validate if the result is a parsable array before caching good data
      try {
        const parsedResult = JSON.parse(resultString);
        if(Array.isArray(parsedResult)) {
           cache.set(cacheKey, {
             timestamp: Date.now(),
             data: resultString 
           });
           console.log(`Successfully generated and cached data for ${cacheKey}`);
        } else {
          // This case should ideally not happen if generateCards always returns '[]' on error
          console.warn(`generateCards did not return a valid array string for ${cacheKey}. Result: ${resultString.substring(0,100)}...`);
        }
      } catch (e) {
         console.error(`Failed to parse result from generateCards for caching ${cacheKey}: ${e}. Result: ${resultString.substring(0,100)}...`);
         // Don't cache bad data, but still return it as it's what generateCards provided
      }
      return resultString;

    } catch (error) { // This catch block in generateWithRetry might not be hit if generateCards handles its own errors
      console.log(`API call failed (attempt ${retries+1}/${maxRetries}) in generateWithRetry:`, error.status || error.message);
      
      if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('quota')) {
        retries++;
        if (retries >= maxRetries) {
          console.error(`Max retries reached for ${cacheKey} due to rate limits/quota.`);
          return JSON.stringify([]); // Return empty array string after max retries
        }
        const delay = Math.pow(2, retries) * 1000 * (Math.random() * 0.5 + 0.75); // Add jitter
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`Unhandled error in generateWithRetry for ${cacheKey}:`, error);
        return JSON.stringify([]); // Return empty array string for other unhandled errors
      }
    }
  }
  console.error(`generateWithRetry exhausted retries for ${cacheKey}.`);
  return JSON.stringify([]); // Fallback after loop if all retries failed
}

// Parallel processing (retained and adapted)
async function generateLargeCardSet({ subject, topic, examType, examBoard, questionType, numCards }) {
  const isSlowPath = (questionType === "essay" || examType === "A-Level" || examType === "IB");
  const batchThreshold = isSlowPath ? 1 : 2; // More aggressive batching: 1-by-1 for slow, else if > 2 cards
  const effectiveBatchSize = isSlowPath ? 1 : 2; // Generate 1 card at a time for slow path, 2 for others in batch

  if (numCards > batchThreshold) { 
    const batchSize = effectiveBatchSize;
    const batches = Math.ceil(numCards / batchSize);
    const promises = [];
    
    console.log(`Splitting ${numCards} cards into ${batches} batches of ~${batchSize} cards for topic "${topic}" (iteration aware).`);
    
    for (let i = 0; i < batches; i++) {
      const cardsInBatch = Math.min(batchSize, numCards - (i * batchSize));
      promises.push(generateWithRetry({ 
        subject, topic, examType, examBoard, questionType, 
        numCards: cardsInBatch, 
        iterationHint: i,      // Pass current iteration index
        totalCardsInSet: numCards // Pass original total number of cards
      }));
    }
    
    try {
      const resultsAsStrings = await Promise.all(promises);
      const combined = resultsAsStrings
        .map(jsonString => {
          try {
            const parsedArray = JSON.parse(jsonString);
            return Array.isArray(parsedArray) ? parsedArray : []; // Ensure it's an array
          } catch (e) {
            console.error("Error parsing batch result string:", e);
            console.error("String was:", jsonString.substring(0,100)+"...");
            return []; // Return empty array for unparsable batch
          }
        })
        .flat();
      console.log(`Combined ${combined.length} cards from ${batches} batches for "${topic}".`);
      return JSON.stringify(combined);
    } catch (error) {
      console.error("Parallel generation error in Promise.all:", error);
      return JSON.stringify([]); // Return empty array string on error
    }
  }
  
  return generateWithRetry({ subject, topic, examType, examBoard, questionType, numCards });
}

module.exports = { 
  // generateCards, // Exposing only the higher-level functions
  generateWithRetry, 
  generateLargeCardSet
};
