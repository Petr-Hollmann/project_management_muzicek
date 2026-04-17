import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import Workers from './pages/Workers';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import Notes from './pages/Notes';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Calendar": Calendar,
    "Settings": Settings,
    "Workers": Workers,
    "Orders": Orders,
    "OrderDetail": OrderDetail,
    "Customers": Customers,
    "CustomerDetail": CustomerDetail,
    "Vehicles": Vehicles,
    "VehicleDetail": VehicleDetail,
    "Notes": Notes,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
