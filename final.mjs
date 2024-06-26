import { HfInference } from '@huggingface/inference';
import { findBestMatch } from 'string-similarity'; // Assuming you use a library like 'string-similarity' for fuzzy matching
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs/promises'; // Using fs/promises for async file operations

const accessToken = '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'; // Need To use HF Token For Access to the tokenClassification Model
const convModelName = 'Clinical-AI-Apollo/Medical-NER';
const hf = new HfInference(accessToken);
const apiKey = '31b4870c5e194841b24ce37023800df2'; //Assembly Ai API key - For Audio transcription
const audioFilePath = './audio.mp3';

const uploadAudio = async (filePath) => {
  const formData = new FormData();
  formData.append('file', await fs.readFile(filePath));

  const response = await axios.post('https://api.assemblyai.com/v2/upload', formData, {
    headers: {
      'authorization': apiKey,
      ...formData.getHeaders(),
    },
  });

  return response.data.upload_url;
};

const transcribeAudio = async (audioUrl) => {
  const response = await axios.post('https://api.assemblyai.com/v2/transcript', {
    audio_url: audioUrl,
  }, {
    headers: {
      'authorization': apiKey,
      'content-type': 'application/json',
    },
  });

  const transcriptId = response.data.id;

  // Polling for the transcription result
  let transcript;
  while (true) {
    const result = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: {
        'authorization': apiKey,
      },
    });

    if (result.data.status === 'completed') {
      transcript = result.data;
      break;
    } else if (result.data.status === 'failed') {
      throw new Error('Transcription failed');
    }

    // Wait for a while before polling again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return transcript.text;
};
let conversation = "";

const run = async () => {
  try {
    const audioUrl = await uploadAudio(audioFilePath);
    const transcriptText = await transcribeAudio(audioUrl);
    conversation = transcriptText;
    // console.log(transcriptText);
    classifyInputFunction(conversation);
  } catch (error) {
    console.error('Error:', error);
  }
};

run();


// Database with all the information about the Medicines
const medicines = {
    "Paracetamol": { "company": "GlaxoSmithKline", "price": 5.00 },
    "Ibuprofen": { "company": "Advil", "price": 6.50 },
    "Amoxicillin": { "company": "Pfizer", "price": 12.00 },
    "Atorvastatin": { "company": "Pfizer", "price": 15.00 },
    "Metformin": { "company": "Bristol-Myers Squibb", "price": 10.00 },
    "Amlodipine": { "company": "Pfizer", "price": 8.00 },
    "Lisinopril": { "company": "Merck", "price": 9.00 },
};




// Function to find the best match in the medicines dictionary
function findMedicationMatch(medicationName) {
    const keys = Object.keys(medicines);
    const { bestMatch } = findBestMatch(medicationName, keys);
    return medicines[bestMatch.target];
}

async function classifyInputFunction(conversation) {
    try {
        const inputText = conversation;

        const response = await hf.tokenClassification({
            model: convModelName,
            inputs: inputText,
        });

        // Spliting the conversation into sentences
        const reflist = inputText.split('.').map(sentence => sentence.trim()).filter(sentence => sentence !== '');

        // Initialize array to store prescriptions
        const prescriptions = [];

        // Iterate over each entity in the response
        for (let i = 0; i < response.length; i++) {
            const entity = response[i];

            // Skip entities that are not relevant to medications
            if (entity.entity_group !== 'MEDICATION') {
                continue;
            }

            // Extract medication name
            const medicationName = entity.word;

            // Check if the medicationName exists in the dictionary
            let medicationInfo = medicines[medicationName];

            // If medicationInfo is undefined (possible spelling error), find best match
            if (!medicationInfo) {
                const closestMatchInfo = findMedicationMatch(medicationName);
                if (closestMatchInfo) {
                    medicationInfo = closestMatchInfo;
                } else {
                    console.error(`No matching medication found for "${medicationName}".`);
                    continue;
                }
            }

            // Find the sentence containing the medication
            const matchedSentence = reflist.find(sentence => sentence.includes(medicationName));

            if (!matchedSentence) {
                console.error(`No sentence found for medication "${medicationName}".`);
                continue;
            }

            // Find DURATION or DATE entities in the same sentence
            const matchedDuration = response.filter(entity => {
                return (entity.entity_group === 'DURATION' || entity.entity_group === 'DATE') &&
                       entity.start >= inputText.indexOf(matchedSentence) &&
                       entity.end <= (inputText.indexOf(matchedSentence) + matchedSentence.length);
            });

            const matchedDosage = response.filter(entity => {
                return (entity.entity_group === 'DOSAGE') &&
                       entity.start >= inputText.indexOf(matchedSentence) &&
                       entity.end <= (inputText.indexOf(matchedSentence) + matchedSentence.length);
            });

            // Output prescription information
            prescriptions.push({
                medication: medicationName,
                duration: matchedDuration.map(d => d.word).join(', '), // Concatenate durations if multiple found
                dosage: matchedDosage.map(d => d.word),
                price: medicationInfo.price.toFixed(2),
                company: medicationInfo.company
            });
        }

        // Output prescription information
        prescriptions.forEach((prescription, index) => {
            console.log(`Your Prescription:`);
            console.log(`- Medication: ${prescription.medication}`);
            console.log(`- Company: ${prescription.company}`);
            console.log(`- Duration: ${prescription.duration}`);
            console.log(`- Dosage: ${prescription.dosage}`)
            console.log(`- Price: $${prescription.price}`);
            console.log(''); 
        });

    } catch (error) {
        console.error('Error interacting with the model:', error);
    }
}
