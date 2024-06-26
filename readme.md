**Description**
Voice based Prescription generation using Hugging Face inference and Assembly AI

**Usage**
To start the application, run:
npm run dev

This command will install dependencies (if not already installed) and start the application.

**Dependencies**
@huggingface/inference (^2.7.0)
axios (^1.7.2)
form-data (^4.0.0)
fs (^0.0.1-security)
string-similarity (^4.0.4)

**Flow**
Audio.mp3 is sent to assembly.ai for transcription and then the response is recorded into the variable 'conversation' as a string which is then sent to HF for tokenClassification where the text is classified into different segments, this is then mapped into a prescription based on the Medicines Dictionary in the Code including the Frequency and Dosage.
