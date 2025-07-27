import React, { useState, useEffect, useMemo } from 'react';
import { Search, User, Stethoscope, FileText, Activity, AlertTriangle, CheckCircle, Loader2, BrainCircuit, Heart, Wind, Bone, ShieldCheck, Mic, ArrowRight, RefreshCw, Home, ArrowLeft, Mail, Download, PlusCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const API_URL = 'https://ai-health-backend-xlho.onrender.com/api/';

const AnimatedIcon = ({ icon: Icon, className }) => <Icon className={`transition-all duration-300 ease-in-out ${className}`} />;

const PatientHistoryModal = ({ history, onClose, patientName }) => {
    if (!history || history.length === 0) return null;
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4"
        >
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                className="bg-slate-800/50 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            >
                <div className="p-6 border-b border-slate-700"><h2 className="text-2xl font-bold text-white">Checkup History for <span className="text-cyan-400">{patientName}</span></h2></div>
                <div className="p-6 overflow-y-auto">
                    <div className="space-y-6">
                        {history.map((item, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-slate-900/50 p-4 rounded-lg border border-slate-700"
                            >
                                <p className="text-sm text-slate-400 mb-2 font-mono">{new Date(item.timestamp).toLocaleString()}</p>
                                <div>
                                    <h4 className="font-semibold text-slate-300 mb-2">Symptoms Reported:</h4>
                                    <div className="flex flex-wrap gap-2 mb-3">{item.symptoms.map(s => <span key={s} className="bg-slate-700 text-slate-200 text-xs font-medium px-2.5 py-1 rounded-full">{s}</span>)}</div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-300 mb-2">Diagnosis:</h4>
                                    <ul className="space-y-2">{item.predictions.map(p => <li key={p.disease} className="text-slate-300 text-sm">- {p.disease} <span className="text-cyan-400 font-medium">({p.probability}%)</span></li>)}</ul>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
                <div className="p-4 bg-slate-800/50 border-t border-slate-700 text-right"><button onClick={onClose} className="bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-cyan-600 transition-colors duration-300">Close</button></div>
            </motion.div>
        </motion.div>
    );
};


export default function App() {
    const [step, setStep] = useState(0);
    // patient state for the creation/update form fields
    const [patient, setPatient] = useState({ name: '', age: '', gender: 'Male', contact: '', address: '' });
    // patientDetails state for the currently active/selected patient
    const [patientDetails, setPatientDetails] = useState(null);
    const [situationText, setSituationText] = useState('');
    const [extractedSymptoms, setExtractedSymptoms] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [patientHistory, setPatientHistory] = useState([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [lookupQuery, setLookupQuery] = useState('');
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [allSymptoms, setAllSymptoms] = useState([]);
    const [manualSymptomQuery, setManualSymptomQuery] = useState('');
    const [autocompleteSuggestion, setAutocompleteSuggestion] = useState('');

    useEffect(() => {
        const fetchAllSymptoms = async () => {
            try {
                const response = await fetch(`${API_URL}/symptoms/`);
                const data = await response.json();
                setAllSymptoms(data);
            } catch (err) {
                console.error("Could not fetch symptom list", err);
            }
        };
        fetchAllSymptoms();
    }, []);

    const handleFormChange = (e) => setPatient({ ...patient, [e.target.name]: e.target.value });
    const handlePhoneChange = (value) => setPatient({ ...patient, contact: value || '' });

    const resetAll = () => {
        setPatient({ name: '', age: '', gender: 'Male', contact: '', address: '' });
        setPatientDetails(null); // CRITICAL: Ensure this is always set to null for a fresh start
        setSituationText('');
        setExtractedSymptoms([]);
        setPredictions([]);
        setError(null);
        setPatientHistory([]);
        setLookupQuery('');
        setSearchSuggestions([]);
        setManualSymptomQuery('');
        setAutocompleteSuggestion('');
    };

    const handleFindOrCreatePatient = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/patients/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patient), // 'patient' state holds form data
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || data.error || 'Failed to find or create patient.');

            // Set the active patient details from the API response
            setPatientDetails(data);
            // Also update the 'patient' form state with the full details from the API
            // This is important if the user navigates back to Step 1 to edit details.
            setPatient(data);

            await fetchPatientHistory(data.id); // Fetch history for this patient
            setStep(2); // Move to symptom input step
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePatientLookup = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSearchSuggestions([]); // Clear suggestions on lookup attempt
        // Ensure that patient-related states are cleared before a new lookup,
        // especially if an old patient's data might be lingering.
        setPatientDetails(null);
        setPatient({ name: '', age: '', gender: 'Male', contact: '', address: '' }); // Reset patient form state too

        try {
            const response = await fetch(`${API_URL}/patients/lookup/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friendly_id: lookupQuery }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Patient not found.');

            // Set the active patient details from the API response
            setPatientDetails(data);
            // Also update the 'patient' form state with the full details of the looked-up patient
            setPatient(data);

            await fetchPatientHistory(data.id);
            setIsHistoryModalOpen(true); // Open history modal
            setStep(2); // Automatically move to symptom input after successful lookup
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchChange = async (query) => {
        setLookupQuery(query);
        if (query.length < 2) {
            setSearchSuggestions([]);
            return;
        }
        try {
            const response = await fetch(`${API_URL}/patients/search/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            const data = await response.json();
            if (response.ok) {
                setSearchSuggestions(data);
            }
        } catch (err) {
            console.error("Search suggestion error:", err);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        // When a suggestion is clicked, directly set patientDetails and patient state
        setPatientDetails(suggestion);
        setPatient(suggestion); // Populate patient form state with selected suggestion
        setLookupQuery(suggestion.friendly_id); // Set the input field to the friendly ID
        setSearchSuggestions([]); // Clear suggestions

        fetchPatientHistory(suggestion.id); // Fetch history for the selected patient
        setIsHistoryModalOpen(true); // Open history modal
        setStep(2); // Move to symptom input
    };

    const handleExtractSymptoms = async () => {
        if (!situationText.trim()) {
            alert("Please describe your situation.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/extract-symptoms/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: situationText }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to extract symptoms.');
            if (data.length === 0) {
                alert("No specific symptoms were recognized. Please try describing your situation with more detail or different words.");
            } else {
                setExtractedSymptoms(prev => [...new Set([...prev, ...data])]);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDiagnose = async () => {
        if (extractedSymptoms.length === 0) {
            alert("No symptoms identified. Please describe your situation again.");
            return;
        }
        if (!patientDetails || !patientDetails.id) {
            setError("Patient details are missing. Please go back and select/create a patient.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/diagnose/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symptoms: extractedSymptoms,
                    patientId: patientDetails.id, // Use patientDetails.id here
                    gender: patientDetails.gender
                }),
            });
            if (!response.ok) throw new Error(`API request failed: ${response.statusText}`);
            const data = await response.json();
            setPredictions(data);
            setStep(3);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPatientHistory = async (pId) => {
        if (!pId) return;
        try {
            const response = await fetch(`${API_URL}/patients/${pId}/history/`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to fetch history.');
            setPatientHistory(data);
        } catch (err) {
            console.error("Fetch history error:", err);
        }
    };

    const handleVoiceSearch = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition is not supported in your browser.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };
        recognition.onresult = (event) => {
            const speechResult = event.results[0][0].transcript;
            setSituationText(speechResult);
        };
        recognition.start();
    };

    const handleNewPatient = () => {
        resetAll(); // Reset all states for a completely new patient
        setStep(1); // Go to patient info step
    };

    const handleGoHome = () => {
        resetAll(); // Reset all states when going home
        setStep(0); // Go to home screen
    };

    const handleEmailReport = async () => {
        const recipient_email = prompt("Please enter the recipient's email address:");
        if (!recipient_email) return;

        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/email-report/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient_email,
                    patient: patientDetails, // Use current patientDetails
                    predictions,
                    as_pdf: false
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to send email.");
            alert(data.message);
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePdfDownload = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/email-report/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient: patientDetails, // Use current patientDetails
                    predictions,
                    as_pdf: true
                }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to generate PDF.");
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Diagnosis_Report_${patientDetails.friendly_id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const getIcon = (d) => {
        const disease = d.toLowerCase();
        if (disease.includes('heart')) return Heart;
        if (disease.includes('migraine') || disease.includes('brain')) return BrainCircuit;
        if (disease.includes('asthma') || disease.includes('cold') || disease.includes('pneumonia') || disease.includes('tuberculosis')) return Wind;
        if (disease.includes('arthritis')) return Bone;
        if (disease.includes('urinary')) return ShieldCheck;
        return Activity;
    };

    const handleSituationTextChange = (e) => {
        const text = e.target.value;
        setSituationText(text);

        const words = text.split(/\s+/);
        const currentWord = words[words.length - 1].toLowerCase();

        if (currentWord.length > 2) {
            const suggestion = allSymptoms.find(s => s.toLowerCase().startsWith(currentWord));
            if (suggestion && suggestion.toLowerCase() !== currentWord) {
                setAutocompleteSuggestion(suggestion);
            } else {
                setAutocompleteSuggestion('');
            }
        } else {
            setAutocompleteSuggestion('');
        }
    };

    const handleSituationKeyDown = (e) => {
        if (e.key === 'Tab' && autocompleteSuggestion) {
            e.preventDefault();
            const words = situationText.split(' ');
            words[words.length - 1] = autocompleteSuggestion;
            setSituationText(words.join(' ') + ' ');
            setAutocompleteSuggestion('');
        }
    };

    const addSymptom = (symptom) => {
        setExtractedSymptoms(prev => [...new Set([...prev, symptom])]);
        setManualSymptomQuery('');
    };

    const removeSymptom = (symptomToRemove) => {
        setExtractedSymptoms(prev => prev.filter(s => s !== symptomToRemove));
    };

    const manualSymptomSuggestions = useMemo(() => {
        if (manualSymptomQuery.length < 2) return [];
        return allSymptoms.filter(s =>
            s.toLowerCase().includes(manualSymptomQuery.toLowerCase()) && !extractedSymptoms.includes(s)
        ).slice(0, 5);
    }, [manualSymptomQuery, allSymptoms, extractedSymptoms]);

    const animationProps = {
        initial: { opacity: 0, y: 30 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -30 },
        transition: { duration: 0.4, ease: "easeInOut" }
    };

    const renderStep = () => {
        // console.log("Current Patient Details in renderStep:", patientDetails); // For debugging
        switch (step) {
            case 1:
                return (
                    <motion.div key="step1" {...animationProps}>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 space-y-6">
                            <button onClick={() => setStep(0)} className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"><ArrowLeft size={16}/> Back to Home</button>
                            <div className="text-center">
                                <h2 className="text-3xl font-bold">Patient Information</h2>
                                <p className="text-slate-400 mt-2">Find an existing patient or create a new record.</p>
                            </div>
                            <form onSubmit={handleFindOrCreatePatient} className="space-y-4">
                                {/* Use 'patient' state for form fields */}
                                <input type="text" name="name" placeholder="Full Name" value={patient.name} onChange={handleFormChange} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition" required />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="number" name="age" placeholder="Age" value={patient.age} onChange={handleFormChange} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition" required />
                                    <select name="gender" value={patient.gender} onChange={handleFormChange} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition">
                                        <option>Male</option>
                                        <option>Female</option>
                                    </select>
                                </div>
                                <div className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 focus-within:ring-2 focus-within:ring-cyan-500 transition">
                                    <PhoneInput
                                        international
                                        defaultCountry="US"
                                        value={patient.contact}
                                        onChange={handlePhoneChange}
                                        className="w-full text-white"
                                    />
                                </div>
                                <textarea name="address" placeholder="Address" value={patient.address} onChange={handleFormChange} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition resize-none" rows="2"></textarea>
                                <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold py-3 px-12 rounded-lg shadow-lg hover:shadow-cyan-500/50 transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50">
                                    {isLoading ? <><Loader2 className="animate-spin" /> Please Wait...</> : <>Continue <ArrowRight /></>}
                                </button>
                            </form>
                            {error && <p className="text-red-400 text-center">{error}</p>}
                        </div>
                    </motion.div>
                );
            case 2:
                return (
                     <motion.div key="step2" {...animationProps}>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 space-y-6">
                            <button onClick={() => setStep(1)} className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"><ArrowLeft size={16}/> Back to Patient Info</button>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-3xl font-bold">Symptom Input</h2>
                                    {/* Display the active patient's name here using patientDetails */}
                                    <p className="text-slate-400 mt-2">Patient: <span className="font-mono text-cyan-400">{patientDetails?.name || 'N/A'}</span> (ID: <span className="font-mono text-cyan-400">{patientDetails?.friendly_id || 'N/A'}</span>)</p>
                                </div>
                                {patientHistory.length > 0 && <button onClick={() => setIsHistoryModalOpen(true)} className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"><FileText size={16}/> View History</button>}
                            </div>

                            <div className="grid md:grid-cols-2 gap-8 pt-4">
                                <div className="space-y-2">
                                    <label className="font-bold text-lg">Option 1: Describe Your Situation</label>
                                    <div className="relative">
                                        <textarea value={situationText} onChange={handleSituationTextChange} onKeyDown={handleSituationKeyDown} placeholder="e.g., I have a runny nose and a sore throat..." rows="5" className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-4 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition resize-none"></textarea>
                                        <button onClick={handleVoiceSearch} className={`absolute top-3 right-3 p-2 rounded-full transition ${isListening ? 'bg-red-500 animate-pulse' : 'bg-cyan-500 hover:bg-cyan-600'}`}>
                                            <Mic size={16} />
                                        </button>
                                    </div>
                                    <div className="text-xs text-slate-400 px-1 h-6">
                                        {autocompleteSuggestion && (
                                            <span>Press <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Tab</kbd> to autocomplete: <span className="font-bold text-cyan-400">{autocompleteSuggestion}</span></span>
                                        )}
                                    </div>
                                    <button onClick={handleExtractSymptoms} disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold py-3 px-12 rounded-lg shadow-lg hover:shadow-cyan-500/50 transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50">
                                        {isLoading ? <><Loader2 className="animate-spin" /> Analyzing...</> : "Analyze Description"}
                                    </button>
                                </div>

                                <div className="space-y-4 relative">
                                    <label className="font-bold text-lg">Option 2: Add Symptoms Manually</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                                        <input type="text" value={manualSymptomQuery} onChange={(e) => setManualSymptomQuery(e.target.value)} placeholder="Search for symptoms..." className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-12 pr-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition" />
                                    </div>
                                    {manualSymptomSuggestions.length > 0 && (
                                        <motion.ul initial={{opacity: 0}} animate={{opacity: 1}} className="absolute w-full bg-slate-700 border border-slate-600 rounded-lg mt-1 text-left z-10 max-h-48 overflow-y-auto">
                                            {manualSymptomSuggestions.map(s => (
                                                <li key={s} onClick={() => addSymptom(s)} className="p-3 hover:bg-slate-600 cursor-pointer border-b border-slate-600 last:border-b-0 flex items-center justify-between">
                                                    <span>{s}</span>
                                                    <PlusCircle size={16} />
                                                </li>
                                            ))}
                                        </motion.ul>
                                    )}
                                </div>
                            </div>

                            {extractedSymptoms.length > 0 && (
                                <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} className="space-y-4 pt-6 border-t border-slate-700 overflow-hidden">
                                    <h3 className="font-bold text-lg">Final Symptom List:</h3>
                                    <div className="flex flex-wrap gap-2 p-4 bg-slate-900/50 rounded-lg">
                                        {extractedSymptoms.map(s => (
                                            <span key={s} className="bg-slate-700 text-slate-200 text-sm font-medium px-3 py-1.5 rounded-full flex items-center gap-2">
                                                {s}
                                                <button onClick={() => removeSymptom(s)}><XCircle size={14} className="hover:text-red-400"/></button>
                                            </span>
                                        ))}
                                    </div>
                                    <button onClick={handleDiagnose} disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold py-3 px-12 rounded-lg shadow-lg hover:shadow-green-500/50 transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50">
                                        {isLoading ? <><Loader2 className="animate-spin" /> Getting Diagnosis...</> : "Get Final Diagnosis"}
                                    </button>
                                </motion.div>
                            )}
                            {error && <p className="text-red-400 text-center">{error}</p>}
                        </div>
                    </motion.div>
                );
            case 3:
                return (
                    <motion.div key="step3" {...animationProps}>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 space-y-6">
                            <button onClick={() => setStep(2)} className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"><ArrowLeft size={16}/> Back to Symptoms</button>
                            <div className="text-center">
                                <h2 className="text-3xl font-bold">Diagnosis Results</h2>
                                {/* Display the active patient's name here using patientDetails */}
                                <p className="text-slate-400 mt-2">For <span className="text-cyan-400 font-semibold">{patientDetails?.name || 'N/A'}</span> (ID: {patientDetails?.friendly_id || 'N/A'})</p>
                            </div>
                            <div className="space-y-6">
                                {predictions.map((pred, index) => (
                                    <motion.div key={pred.disease} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.2 }} className={`p-5 rounded-xl border-2 transition-all duration-500 ${index === 0 ? 'bg-cyan-500/10 border-cyan-500 shadow-cyan-500/20 shadow-lg' : 'bg-slate-700/30 border-slate-700'}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${index === 0 ? 'bg-cyan-500/20' : 'bg-slate-600/50'}`}><AnimatedIcon icon={getIcon(pred.disease)} className={`w-6 h-6 ${index === 0 ? 'text-cyan-400' : 'text-slate-300'}`} /></div>
                                                <h3 className={`text-xl font-bold ${index === 0 ? 'text-cyan-300' : 'text-white'}`}>{pred.disease}</h3>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-2xl font-bold ${index === 0 ? 'text-cyan-400' : 'text-slate-200'}`}>{pred.probability}%</div>
                                                <div className="text-xs text-slate-400">Probability</div>
                                            </div>
                                        </div>
                                        <p className="text-slate-300 mb-4 text-sm">{pred.description}</p>
                                        <div>
                                            <h4 className="font-semibold text-slate-200 mb-2 text-sm">Recommended Actions:</h4>
                                            <ul className="space-y-1.5 list-inside">
                                                {pred.actions.map((action, i) => <li key={i} className="flex items-start gap-2 text-sm text-slate-400"><CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"/><span>{action}</span></li>)}
                                            </ul>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                            <div className="flex gap-4">
                                <button onClick={handleEmailReport} disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-slate-600 text-white font-bold py-3 px-12 rounded-lg hover:bg-slate-700 transition-all duration-300">
                                    <Mail size={16}/> Email Report
                                </button>
                                <button onClick={handlePdfDownload} disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-slate-600 text-white font-bold py-3 px-12 rounded-lg hover:bg-slate-700 transition-all duration-300">
                                    <Download size={16}/> Download Report
                                </button>
                                <button onClick={handleNewPatient} className="w-full flex items-center justify-center gap-2 bg-slate-600 text-white font-bold py-3 px-12 rounded-lg hover:bg-slate-700 transition-all duration-300">
                                    <RefreshCw size={16}/> New Patient
                                </button>
                            </div>
                            <div className="text-center mt-6 text-xs text-slate-500 p-3 bg-slate-900/50 rounded-lg">
                                <AlertTriangle className="inline w-4 h-4 mr-2"/>
                                Disclaimer: This is an AI-powered estimation and not a substitute for professional medical advice.
                            </div>
                        </div>
                    </motion.div>
                );
            default:
                return (
                    <motion.div key="step0" {...animationProps}>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 space-y-8 text-center">
                            <div>
                                <h2 className="text-3xl font-bold">Welcome to the AI Health Assistant</h2>
                                <p className="text-slate-400 mt-2">How can we help you today?</p>
                            </div>
                            <div className="space-y-4">
                                <button onClick={() => { resetAll(); setStep(1); }} className="w-full text-lg flex items-center justify-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold py-4 px-12 rounded-lg shadow-lg hover:shadow-cyan-500/50 transform hover:-translate-y-1 transition-all duration-300">
                                    <Stethoscope /> Start New Diagnosis
                                </button>
                                <div className="pt-4 relative">
                                    <h3 className="text-xl font-bold">Check Existing History</h3>
                                    <p className="text-slate-400 mt-1 mb-4 text-sm">Enter a Patient Name or ID to view past checkups.</p>
                                    <form onSubmit={handlePatientLookup} className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Search by Name or PAT-ID..."
                                            value={lookupQuery}
                                            onChange={(e) => handleSearchChange(e.target.value)}
                                            className="flex-grow bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition"
                                        />
                                        <button type="submit" disabled={isLoading} className="flex items-center justify-center gap-2 bg-slate-600 text-white font-bold p-3 rounded-lg hover:bg-slate-700 transition-all duration-300 disabled:opacity-50">
                                            {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                                        </button>
                                    </form>
                                    <AnimatePresence>
                                        {searchSuggestions.length > 0 && (
                                            <motion.ul
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute w-full bg-slate-700 border border-slate-600 rounded-lg mt-2 text-left z-10"
                                            >
                                                {searchSuggestions.map(s => (
                                                    <li
                                                        key={s.friendly_id}
                                                        onClick={() => handleSuggestionClick(s)}
                                                        className="p-3 hover:bg-slate-600 cursor-pointer border-b border-slate-600 last:border-b-0"
                                                    >
                                                        <p className="font-semibold">{s.name}</p>
                                                        <p className="text-xs text-slate-400">{s.friendly_id}</p>
                                                    </li>
                                                ))}
                                            </motion.ul>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                             {error && <p className="text-red-400 text-center mt-4">{error}</p>}
                        </div>
                    </motion.div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans bg-gradient-to-br from-slate-900 to-blue-900/30">
            <header className="p-4">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3 text-2xl font-bold tracking-tight">
                        <Stethoscope className="text-cyan-400 w-8 h-8"/>
                        <h1>AI Health Assistant</h1>
                    </div>
                    {step > 0 && <button onClick={handleGoHome} className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"><Home size={16}/> Go Home</button>}
                </div>
            </header>

            <main className="container mx-auto p-4 flex flex-col items-center">
                <AnimatePresence>
                    {/* PatientHistoryModal uses patientDetails?.name for its title */}
                    {isHistoryModalOpen && <PatientHistoryModal history={patientHistory} onClose={() => setIsHistoryModalOpen(false)} patientName={patientDetails?.name} />}
                </AnimatePresence>

                <div className="w-full max-w-4xl mt-8">
                    <AnimatePresence mode="wait">
                        {renderStep()}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}