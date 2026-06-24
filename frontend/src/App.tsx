import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import CheckinsAdmin from './pages/CheckinsAdmin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/admin/checkins" element={<CheckinsAdmin />} />
      </Routes>
    </BrowserRouter>
  );
}
