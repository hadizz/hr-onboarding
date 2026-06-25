import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import CheckinsAdmin from './pages/CheckinsAdmin';
import EvalsAdmin from './pages/EvalsAdmin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/admin/checkins" element={<CheckinsAdmin />} />
        <Route path="/admin/evals" element={<EvalsAdmin />} />
      </Routes>
    </BrowserRouter>
  );
}
