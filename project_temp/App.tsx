import React from 'react';
    import '@radix-ui/themes/styles.css';
    import { Theme } from '@radix-ui/themes';
    import { ToastContainer } from 'react-toastify';
    import 'react-toastify/dist/ReactToastify.css';
    import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

    import Home from './src/pages/Home.tsx';
    import Events from './src/pages/Events.tsx';
    import Register from './src/pages/Register.tsx';
    import Search from './src/pages/Search.tsx';
    import AdminDashboard from './src/pages/AdminDashboard.tsx';
    import NotFound from './src/pages/NotFound.tsx';

    const App: React.FC = () => {
      return (
        <Theme appearance="light" accentColor="amber" radius="large">
          <Router>
            <main className="min-h-screen font-sans selection:bg-secondary selection:text-primary">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/events" element={<Events />} />
                <Route path="/register" element={<Register />} />
                <Route path="/search" element={<Search />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored"
              />
            </main>
          </Router>
        </Theme>
      );
    }

    export default App;