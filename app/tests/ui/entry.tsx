import { createRoot } from "react-dom/client";
import HomePage from "../../src/app/page";
import VaultPage from "../../src/app/vault/page";
import HeirPage from "../../src/app/heir/page";
import OperatorPage from "../../src/app/operator/page";
const pages: Record<string, React.ComponentType> = { "/": HomePage, "/vault": VaultPage, "/heir": HeirPage, "/operator": OperatorPage };
const Page = pages[window.location.pathname] ?? HomePage;
createRoot(document.getElementById("root")!).render(<Page />);
